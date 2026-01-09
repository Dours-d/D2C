-- ==================== CORE TABLES ====================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    password_hash VARCHAR(255) NOT NULL
);

CREATE TABLE campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name VARCHAR(255) NOT NULL,
    description TEXT,
    whatsapp_number VARCHAR(20) NOT NULL, -- Changed from email to number
    wallet_address VARCHAR(255), -- TRON wallet address
    created_by UUID REFERENCES users(user_id),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('whatsapp', 'whydonate', 'manual')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')) DEFAULT 'draft',
    total_donations_eur DECIMAL(18,2) DEFAULT 0.00,
    total_fees_eur DECIMAL(18,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

CREATE TABLE currencies (
    currency_code CHAR(3) PRIMARY KEY,
    currency_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5),
    is_crypto BOOLEAN DEFAULT false,
    decimal_places INTEGER DEFAULT 2
);

-- Insert base currencies
INSERT INTO currencies (currency_code, currency_name, symbol, is_crypto, decimal_places) VALUES
('EUR', 'Euro', '€', false, 2),
('USD', 'US Dollar', '$', false, 2),
('USDT', 'Tether', 'USDT', true, 2),
('TRX', 'Tron', 'TRX', true, 6);

CREATE TABLE exchange_rates (
    exchange_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency CHAR(3) REFERENCES currencies(currency_code),
    target_currency CHAR(3) REFERENCES currencies(currency_code),
    rate DECIMAL(18,8) NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('stripe', 'manual', 'simplex')),
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donations (
    donation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('whatsapp', 'whydonate', 'manual')),
    source_identifier VARCHAR(255), -- WhatsApp message ID or WhyDonate ID
    
    -- Donor information
    donor_name VARCHAR(255),
    whatsapp_number VARCHAR(20), -- WhatsApp number instead of email
    email VARCHAR(255),
    
    -- Amount information
    original_amount DECIMAL(18,8) NOT NULL,
    original_currency CHAR(3) REFERENCES currencies(currency_code),
    euro_amount DECIMAL(18,8) NOT NULL,
    conversion_rate DECIMAL(12,6) NOT NULL,
    
    -- Fee breakdown (25% total)
    total_fee_percent DECIMAL(5,2) DEFAULT 25.00,
    debt_fee_percent DECIMAL(5,2) DEFAULT 10.00,
    operational_fee_percent DECIMAL(5,2) DEFAULT 10.00,
    transaction_fee_percent DECIMAL(5,2) DEFAULT 5.00,
    debt_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    operational_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    transaction_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    net_amount_eur DECIMAL(18,8) NOT NULL, -- After all fees
    
    donation_date TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'converted', 'batched', 'sent', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Audit fields
    processed_by UUID REFERENCES users(user_id),
    processed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_donations_campaign ON donations(campaign_id, status);
CREATE INDEX idx_donations_whatsapp ON donations(whatsapp_number) WHERE source_type = 'whatsapp';
CREATE INDEX idx_exchange_rates_active ON exchange_rates(valid_to IS NULL);

-- ==================== WHATSAPP SPECIFIC TABLES ====================
CREATE TABLE whatsapp_chats (
    chat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(20) NOT NULL, -- WhatsApp number as identifier
    message_id VARCHAR(255) NOT NULL,
    sender_number VARCHAR(20) NOT NULL, -- Sender's WhatsApp number
    message_text TEXT NOT NULL,
    message_timestamp TIMESTAMP NOT NULL,
    
    -- Extracted data
    extracted_wallet_address VARCHAR(255),
    extracted_campaign_link VARCHAR(500),
    extracted_amount DECIMAL(18,8),
    extracted_currency VARCHAR(10),
    
    processing_status VARCHAR(20) CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')) DEFAULT 'pending',
    processing_result TEXT,
    processed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(whatsapp_number, message_id)
);

CREATE TABLE whatsapp_scan_jobs (
    scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(20) NOT NULL,
    initiated_by UUID REFERENCES users(user_id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'scanning', 'completed', 'failed')) DEFAULT 'pending',
    
    -- Statistics
    messages_scanned INTEGER DEFAULT 0,
    donations_identified INTEGER DEFAULT 0,
    wallets_found INTEGER DEFAULT 0,
    campaigns_created INTEGER DEFAULT 0,
    campaigns_updated INTEGER DEFAULT 0,
    
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== WHY DONATE SPECIFIC TABLES ====================
CREATE TABLE whydonate_payouts (
    payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whydonate_payout_id VARCHAR(255) UNIQUE,
    payout_date DATE NOT NULL,
    
    -- Donor information (from WhyDonate)
    donor_name VARCHAR(255),
    donor_email VARCHAR(255),
    donor_phone VARCHAR(20),
    
    -- Amount information
    amount DECIMAL(18,2) NOT NULL,
    currency CHAR(3) REFERENCES currencies(currency_code),
    fee DECIMAL(18,2) DEFAULT 0.00,
    net_amount DECIMAL(18,2) NOT NULL,
    
    -- Campaign reference
    campaign_reference VARCHAR(255),
    campaign_id UUID REFERENCES campaigns(campaign_id),
    
    -- Status
    status VARCHAR(50),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    
    -- Raw data for audit
    raw_data JSONB
);

-- ==================== TRANSACTION BATCHING TABLES ====================
CREATE TABLE transaction_batches (
    batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) UNIQUE NOT NULL DEFAULT 'BATCH-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS'),
    campaign_id UUID REFERENCES campaigns(campaign_id),
    
    -- Amount breakdown
    total_gross_eur DECIMAL(18,8) NOT NULL, -- Before fees
    total_debt_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00, -- 10%
    total_operational_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00, -- 10%
    total_transaction_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00, -- 5%
    total_net_eur DECIMAL(18,8) NOT NULL, -- After 25% fees
    
    -- USDT conversion
    target_usdt_amount DECIMAL(18,8),
    eur_to_usdt_rate DECIMAL(12,6),
    simplex_fee DECIMAL(18,8),
    
    -- Wallet information
    target_wallet VARCHAR(255) NOT NULL, -- Atomic Wallet or similar
    network VARCHAR(50) NOT NULL DEFAULT 'TRON',
    
    -- Status and tracking
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'pending', 'processing', 'awaiting_simplex', 'sending', 'completed', 'failed', 'cancelled')) DEFAULT 'draft',
    initiated_by UUID REFERENCES users(user_id),
    initiated_at TIMESTAMP,
    simplex_processing_at TIMESTAMP,
    sent_to_blockchain_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Blockchain information
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    
    -- Metadata
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE batch_donations (
    batch_donation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES transaction_batches(batch_id) ON DELETE CASCADE,
    donation_id UUID REFERENCES donations(donation_id) ON DELETE CASCADE,
    UNIQUE(batch_id, donation_id)
);

CREATE TABLE blockchain_transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES transaction_batches(batch_id),
    donation_id UUID REFERENCES donations(donation_id),
    
    from_wallet VARCHAR(255),
    to_wallet VARCHAR(255) NOT NULL,
    usdt_amount DECIMAL(18,8) NOT NULL,
    network_fee_trx DECIMAL(18,8),
    network_fee_usdt DECIMAL(18,8),
    
    transaction_hash VARCHAR(255) UNIQUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'confirmed', 'failed')) DEFAULT 'pending',
    block_number BIGINT,
    confirmations INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== FEE MANAGEMENT TABLES ====================
CREATE TABLE fee_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES transaction_batches(batch_id),
    donation_id UUID REFERENCES donations(donation_id),
    
    fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('debt', 'operational', 'transaction')),
    fee_percent DECIMAL(5,2) NOT NULL,
    fee_amount_eur DECIMAL(18,8) NOT NULL,
    fee_amount_usdt DECIMAL(18,8),
    
    destination_wallet VARCHAR(255),
    destination_account VARCHAR(255), -- Bank account or other
    
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transferred BOOLEAN DEFAULT false,
    transferred_at TIMESTAMP,
    transfer_reference VARCHAR(255)
);

CREATE TABLE operational_accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) CHECK (account_type IN ('bank', 'crypto_wallet', 'payment_processor')),
    account_details JSONB,
    currency CHAR(3) REFERENCES currencies(currency_code),
    current_balance DECIMAL(18,8) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== AUDIT & LOGGING TABLES ====================
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    config_type VARCHAR(20) NOT NULL CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(user_id)
);

-- ==================== TRIGGERS FOR UPDATED_AT ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON transaction_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== INITIAL DATA ====================
INSERT INTO system_config (config_key, config_value, config_type, description) VALUES
('fee_total_percent', '25', 'number', 'Total fee percentage (25%)'),
('fee_debt_percent', '10', 'number', 'Debt repayment fee percentage (10%)'),
('fee_operational_percent', '10', 'number', 'Operational costs fee percentage (10%)'),
('fee_transaction_percent', '5', 'number', 'Transaction fee percentage (5%)'),
('default_network', 'TRON', 'string', 'Default blockchain network'),
('stripe_exchange_rate_endpoint', 'https://api.stripe.com/v1/exchange_rates', 'string', 'Stripe API endpoint for exchange rates'),
('simplex_api_endpoint', 'https://sandbox.test-simplex.com', 'string', 'Simplex API endpoint (sandbox)'),
('tron_scan_api', 'https://api.tronscan.org/api', 'string', 'TRON blockchain explorer API');

-- Create default admin user (password: Admin123! - change in production)
INSERT INTO users (user_id, username, email, role, password_hash) VALUES
('11111111-1111-1111-1111-111111111111', 'admin', 'admin@yourdomain.com', 'admin', '$2b$10$YourHashedPasswordHere');