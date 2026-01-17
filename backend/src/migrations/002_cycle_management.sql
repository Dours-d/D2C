-- ==================== PROCESSING CYCLES ====================
-- Processing cycle configuration
CREATE TABLE IF NOT EXISTS processing_cycles (
    cycle_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_type VARCHAR(20) NOT NULL CHECK (cycle_type IN ('daily', 'weekly', 'biweekly', 'monthly', 'manual')),
    
    -- Trigger conditions
    trigger_on_chain BOOLEAN DEFAULT FALSE,
    trigger_banking BOOLEAN DEFAULT TRUE,
    minimum_amount_eur DECIMAL(18,2) DEFAULT 100.00,
    
    -- Timing
    preferred_weekday INTEGER CHECK (preferred_weekday BETWEEN 1 AND 5), -- 1=Monday
    preferred_time TIME DEFAULT '10:00:00',
    
    -- Fee optimization rules
    optimize_for_fees BOOLEAN DEFAULT TRUE,
    group_transactions BOOLEAN DEFAULT TRUE,
    max_wait_days INTEGER DEFAULT 7,
    
    -- Previous cycle tracking
    previous_cycle VARCHAR(20),
    changed_by UUID REFERENCES users(user_id),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processing_cycles_active ON processing_cycles(is_active, effective_from DESC);

-- ==================== CYCLE EXECUTIONS ====================
-- Cycle execution history
CREATE TABLE IF NOT EXISTS cycle_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID REFERENCES processing_cycles(cycle_id),
    
    -- Execution details
    scheduled_time TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results
    donations_processed INTEGER DEFAULT 0,
    total_amount_eur DECIMAL(18,2) DEFAULT 0.00,
    total_fees_eur DECIMAL(18,2) DEFAULT 0.00,
    
    -- Strategy used
    primary_strategy VARCHAR(50) CHECK (primary_strategy IN ('crypto_first', 'bank_fallback', 'mixed')),
    crypto_provider VARCHAR(50),
    bank_provider VARCHAR(50),
    
    -- Status
    status VARCHAR(50) CHECK (status IN ('scheduled', 'processing', 'completed', 'failed', 'partial')),
    error_message TEXT,
    
    -- Performance metrics
    processing_time_seconds INTEGER,
    fee_efficiency DECIMAL(5,2), -- Percentage saved vs individual processing
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cycle_executions_cycle ON cycle_executions(cycle_id);
CREATE INDEX idx_cycle_executions_status ON cycle_executions(status);
CREATE INDEX idx_cycle_executions_created ON cycle_executions(created_at DESC);

-- ==================== FEE OPTIMIZATION LOGS ====================
-- Fee optimization logs
CREATE TABLE IF NOT EXISTS fee_optimization_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES cycle_executions(execution_id),
    
    -- Before optimization
    individual_transactions INTEGER,
    individual_cost_eur DECIMAL(18,2),
    
    -- After optimization
    grouped_transactions INTEGER,
    grouped_cost_eur DECIMAL(18,2),
    
    -- Savings
    savings_eur DECIMAL(18,2) GENERATED ALWAYS AS (individual_cost_eur - grouped_cost_eur) STORED,
    savings_percent DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN individual_cost_eur > 0 
        THEN ((individual_cost_eur - grouped_cost_eur) / individual_cost_eur * 100)
        ELSE 0 END
    ) STORED,
    
    -- Strategy details
    grouping_strategy VARCHAR(100),
    provider_selection VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fee_optimization_execution ON fee_optimization_logs(execution_id);

-- ==================== CYCLE ADJUSTMENT RULES ====================
-- Dynamic cycle adjustment rules
CREATE TABLE IF NOT EXISTS cycle_adjustment_rules (
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Conditions
    min_weekly_amount DECIMAL(18,2),
    max_weekly_amount DECIMAL(18,2),
    min_donation_count INTEGER,
    max_donation_count INTEGER,
    avg_donation_amount DECIMAL(18,2),
    
    -- Action
    recommended_cycle VARCHAR(20),
    priority INTEGER DEFAULT 1,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cycle_adjustment_rules_active ON cycle_adjustment_rules(is_active, priority);

-- Insert default adjustment rules
INSERT INTO cycle_adjustment_rules (
    min_weekly_amount, max_weekly_amount, min_donation_count, 
    avg_donation_amount, recommended_cycle, priority, description
) VALUES
(5000, 9999999, 20, NULL, 'daily', 1, 'High volume - process daily'),
(1000, 5000, 5, NULL, 'weekly', 2, 'Medium volume - process weekly'),
(0, 1000, NULL, 100, 'biweekly', 3, 'Low volume but large donations'),
(0, 1000, NULL, 50, 'monthly', 4, 'Low volume small donations')
ON CONFLICT DO NOTHING;

-- Insert default processing cycle
INSERT INTO processing_cycles (
    cycle_type, trigger_on_chain, trigger_banking, minimum_amount_eur,
    optimize_for_fees, group_transactions, max_wait_days, is_active
) VALUES (
    'weekly', FALSE, TRUE, 100.00,
    TRUE, TRUE, 7, TRUE
)
ON CONFLICT DO NOTHING;
