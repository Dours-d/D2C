-- Insert default currencies
INSERT INTO currencies (currency_code, currency_name, symbol, is_crypto, decimal_places) VALUES
('EUR', 'Euro', '€', FALSE, 2),
('USD', 'US Dollar', '$', FALSE, 2),
('GBP', 'British Pound', '£', FALSE, 2),
('USDT', 'Tether', 'USDT', TRUE, 2),
('TRX', 'Tron', 'TRX', TRUE, 6);

-- Create default admin user (password: Admin123!)
INSERT INTO users (user_id, username, email, password_hash, role) VALUES
('11111111-1111-1111-1111-111111111111', 
 'admin', 
 'admin@donationplatform.com',
 '$2b$10$KvqkP1bV5zQY9QY7W8tZ7uB7d8F9G0H1I2J3K4L5M6N7O8P9Q0R1S2T3', -- bcrypt hash of 'Admin123!'
 'admin');

-- Insert sample campaign
INSERT INTO campaigns (
    campaign_id,
    campaign_name,
    description,
    whatsapp_number,
    wallet_address,
    source_type,
    status
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Emergency Relief Fund',
    'Emergency relief for disaster affected families',
    '+1234567890',
    'TXYZ1234567890abcdefghijklmnopqrstuvw',
    'manual',
    'active'
);

-- Insert base exchange rates
INSERT INTO exchange_rates (base_currency, target_currency, rate, source, valid_from) VALUES
('USD', 'EUR', 0.92, 'stripe', NOW()),
('EUR', 'USD', 1.09, 'stripe', NOW()),
('EUR', 'USDT', 1.08, 'simplex', NOW());
