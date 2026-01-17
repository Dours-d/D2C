-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== USERS ====================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== CAMPAIGNS ====================
CREATE TABLE campaigns (
    campaign_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_name VARCHAR(255) NOT NULL,
    description TEXT,
    whatsapp_number VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(255),
    created_by UUID REFERENCES users(user_id),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('whatsapp', 'whydonate', 'manual')) DEFAULT 'manual',
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')) DEFAULT 'draft',
    
    -- Statistics
    total_donations_count INTEGER DEFAULT 0,
    total_donations_eur DECIMAL(18,2) DEFAULT 0.00,
    total_fees_eur DECIMAL(18,2) DEFAULT 0.00,
    last_donation_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    
    -- Indexes
    INDEX idx_campaigns_whatsapp (whatsapp_number),
    INDEX idx_campaigns_status (status)
);

-- ==================== CURRENCIES ====================
CREATE TABLE currencies (
    currency_code CHAR(3) PRIMARY KEY,
    currency_name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5),
    is_crypto BOOLEAN DEFAULT FALSE,
    decimal_places INTEGER DEFAULT 2,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== DONATIONS (CORE TABLE) ====================
CREATE TABLE donations (
    donation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('whatsapp', 'whydonate', 'manual')),
    source_identifier VARCHAR(255),
    
    -- Donor information (WhatsApp number is primary identifier)
    donor_name VARCHAR(255),
    whatsapp_number VARCHAR(20),
    email VARCHAR(255),
    
    -- Amount information
    original_amount DECIMAL(18,8) NOT NULL,
    original_currency CHAR(3) REFERENCES currencies(currency_code),
    euro_amount DECIMAL(18,8) NOT NULL,
    conversion_rate DECIMAL(12,6) NOT NULL,
    
    -- FEE BREAKDOWN (25% TOTAL)
    total_fee_percent DECIMAL(5,2) DEFAULT 25.00,
    debt_fee_percent DECIMAL(5,2) DEFAULT 10.00,
    operational_fee_percent DECIMAL(5,2) DEFAULT 10.00,
    transaction_fee_percent DECIMAL(5,2) DEFAULT 5.00,
    
    debt_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    operational_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    transaction_fee_amount DECIMAL(18,8) DEFAULT 0.00,
    
    net_amount_eur DECIMAL(18,8) NOT NULL, -- After 25% fees (75% of original)
    
    donation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'converted', 'batched', 'sent', 'failed', 'refunded')) DEFAULT 'pending',
    
    -- Processing information
    processed_by UUID REFERENCES users(user_id),
    processed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_donations_campaign_status (campaign_id, status),
    INDEX idx_donations_whatsapp (whatsapp_number),
    INDEX idx_donations_date (donation_date),
    INDEX idx_donations_status (status)
);

-- ==================== WHATSAPP CHATS ====================
CREATE TABLE whatsapp_chats (
    chat_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number VARCHAR(20) NOT NULL,
    message_id VARCHAR(255) NOT NULL,
    sender_number VARCHAR(20) NOT NULL,
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
    
    -- Unique constraint
    UNIQUE(whatsapp_number, message_id),
    
    -- Indexes
    INDEX idx_whatsapp_chats_number (whatsapp_number),
    INDEX idx_whatsapp_chats_status (processing_status)
);

-- ==================== TRANSACTION BATCHES ====================
CREATE TABLE transaction_batches (
    batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_number VARCHAR(50) UNIQUE NOT NULL DEFAULT 'BATCH-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS'),
    campaign_id UUID REFERENCES campaigns(campaign_id),
    
    -- Amount breakdown (with 25% fees)
    total_gross_eur DECIMAL(18,8) NOT NULL,
    total_debt_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    total_operational_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    total_transaction_fee_eur DECIMAL(18,8) NOT NULL DEFAULT 0.00,
    total_net_eur DECIMAL(18,8) NOT NULL,
    
    -- USDT conversion
    target_usdt_amount DECIMAL(18,8),
    eur_to_usdt_rate DECIMAL(12,6),
    simplex_fee DECIMAL(18,8),
    simplex_transaction_id VARCHAR(255),
    
    -- Wallet information
    target_wallet VARCHAR(255) NOT NULL,
    network VARCHAR(50) NOT NULL DEFAULT 'TRON',
    
    -- Status tracking
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'draft', 'pending', 'processing', 'awaiting_simplex', 
        'simplex_processing', 'sending', 'completed', 'failed', 'cancelled'
    )) DEFAULT 'draft',
    
    initiated_by UUID REFERENCES users(user_id),
    initiated_at TIMESTAMP,
    simplex_processing_at TIMESTAMP,
    sent_to_blockchain_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Blockchain information
    transaction_hash VARCHAR(255),
    block_number BIGINT,
    
    notes TEXT,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_batches_status (status),
    INDEX idx_batches_campaign (campaign_id),
    INDEX idx_batches_created (created_at)
);

-- ==================== BATCH DONATIONS (JUNCTION) ====================
CREATE TABLE batch_donations (
    batch_donation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES transaction_batches(batch_id) ON DELETE CASCADE,
    donation_id UUID REFERENCES donations(donation_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(batch_id, donation_id)
);

-- ==================== FEE ALLOCATIONS ====================
CREATE TABLE fee_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES transaction_batches(batch_id),
    donation_id UUID REFERENCES donations(donation_id),
    
    fee_type VARCHAR(20) NOT NULL CHECK (fee_type IN ('debt', 'operational', 'transaction')),
    fee_percent DECIMAL(5,2) NOT NULL,
    fee_amount_eur DECIMAL(18,8) NOT NULL,
    fee_amount_usdt DECIMAL(18,8),
    
    destination_wallet VARCHAR(255),
    destination_account VARCHAR(255),
    
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    transferred BOOLEAN DEFAULT FALSE,
    transferred_at TIMESTAMP,
    transfer_reference VARCHAR(255),
    
    -- Indexes
    INDEX idx_fee_allocations_batch (batch_id),
    INDEX idx_fee_allocations_type (fee_type)
);

-- ==================== EXCHANGE RATES ====================
CREATE TABLE exchange_rates (
    exchange_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency CHAR(3) NOT NULL,
    target_currency CHAR(3) NOT NULL,
    rate DECIMAL(18,8) NOT NULL,
    source VARCHAR(50) NOT NULL CHECK (source IN ('stripe', 'manual', 'simplex')),
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for active rates
    INDEX idx_exchange_rates_active (base_currency, target_currency, valid_to IS NULL)
);

-- ==================== AUDIT LOGS ====================
CREATE TABLE audit_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_date (created_at)
);

-- ==================== TRIGGERS ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables
CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_donations_updated_at 
    BEFORE UPDATE ON donations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_batches_updated_at 
    BEFORE UPDATE ON transaction_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
