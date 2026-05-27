-- Supabase Schema for Blindference
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ICL Tables
-- ============================================

-- 1. inference_requests
CREATE TABLE IF NOT EXISTS inference_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  invocation_id TEXT,
  developer_address TEXT NOT NULL,
  model_id TEXT NOT NULL,
  mode TEXT DEFAULT 'text',
  status TEXT DEFAULT 'queued',
  leader_address TEXT,
  verifier_addresses TEXT[] DEFAULT '{}',
  candidate_addresses TEXT[] DEFAULT '{}',
  encrypted_features JSONB DEFAULT '[]',
  feature_types TEXT[] DEFAULT '{}',
  loan_id TEXT,
  coverage_type TEXT,
  max_fee_gnk BIGINT DEFAULT 0,
  min_tier INT DEFAULT 0,
  zdr_required BOOLEAN DEFAULT FALSE,
  verifier_count INT DEFAULT 2,
  metadata JSONB DEFAULT '{}',
  prompt_cid TEXT,
  encrypted_prompt_key_high TEXT,
  encrypted_prompt_key_low TEXT,
  encrypted_output_key_high TEXT,
  encrypted_output_key_low TEXT,
  output_cid TEXT,
  commitment_hash TEXT,
  result_hash TEXT,
  result_preview TEXT,
  risk_score INT,
  confirm_count INT DEFAULT 0,
  reject_count INT DEFAULT 0,
  aggregated_confidence INT,
  text_mode BOOLEAN DEFAULT FALSE,
  claimed_nodes TEXT[] DEFAULT '{}',
  node_assignments JSONB DEFAULT '{}',
  leader_output_ready BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,
  dispute_deadline TIMESTAMPTZ,
  chain_tx_hash TEXT,
  escrow_id BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. quorum_assignments
CREATE TABLE IF NOT EXISTS quorum_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  leader_address TEXT NOT NULL,
  verifier_addresses TEXT[] NOT NULL,
  candidate_addresses TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. verifier_verdicts
CREATE TABLE IF NOT EXISTS verifier_verdicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  verifier_address TEXT NOT NULL,
  accepted BOOLEAN,
  confidence INT,
  reason TEXT,
  result_hash TEXT,
  risk_score INT,
  provider TEXT,
  model TEXT,
  summary TEXT,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, verifier_address)
);

-- 4. quorum_certificates
CREATE TABLE IF NOT EXISTS quorum_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  leader_address TEXT NOT NULL,
  verifier_addresses TEXT[] NOT NULL,
  result_hash TEXT NOT NULL,
  confirm_count INT NOT NULL,
  reject_count INT NOT NULL,
  aggregated_confidence INT NOT NULL,
  accepted BOOLEAN NOT NULL,
  chain_tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. permits
CREATE TABLE IF NOT EXISTS permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id TEXT UNIQUE NOT NULL,
  permits JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. node_runtimes
CREATE TABLE IF NOT EXISTS node_runtimes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_address TEXT UNIQUE NOT NULL,
  callback_url TEXT,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. operators
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_address TEXT UNIQUE NOT NULL,
  model_tiers INT[] DEFAULT '{}',
  supported_model_ids TEXT[] DEFAULT '{}',
  location TEXT DEFAULT 'unknown',
  jurisdiction TEXT DEFAULT 'global',
  zdr_compliant BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  attestation_type TEXT DEFAULT 'mock',
  attestation_document_hash TEXT,
  attestation_counterparty TEXT DEFAULT '0x0000000000000000000000000000000000000000',
  attestation_effective_at BIGINT,
  attestation_expires_at BIGINT,
  min_stake BIGINT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_accepted INT DEFAULT 0,
  tasks_rejected INT DEFAULT 0,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. disputes
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT UNIQUE NOT NULL,
  task_id TEXT NOT NULL,
  developer_address TEXT,
  dispute_id TEXT,
  evidence_hash TEXT,
  evidence_uri TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. model_catalog
CREATE TABLE IF NOT EXISTS model_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id TEXT UNIQUE NOT NULL,
  name TEXT,
  provider TEXT,
  min_tier INT DEFAULT 0,
  zdr_required BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Payment Service Tables
-- ============================================

-- 10. credits
CREATE TABLE IF NOT EXISTS credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address TEXT UNIQUE NOT NULL,
  balance_cusdc NUMERIC DEFAULT 0,
  balance_blind NUMERIC DEFAULT 0,
  total_deposited_cusdc NUMERIC DEFAULT 0,
  total_deposited_blind NUMERIC DEFAULT 0,
  total_spent_cusdc NUMERIC DEFAULT 0,
  total_spent_blind NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 11. jobs
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  task_id TEXT,
  user_address TEXT NOT NULL,
  model_id TEXT NOT NULL,
  amount_cusdc NUMERIC DEFAULT 0,
  amount_blind NUMERIC DEFAULT 0,
  insurance_opt_in BOOLEAN DEFAULT FALSE,
  insurance_premium_cusdc NUMERIC DEFAULT 0,
  escrow_id BIGINT,
  coverage_id INT,
  status TEXT DEFAULT 'PENDING_PAYMENT',
  leader_address TEXT,
  verifier_addresses TEXT[] DEFAULT '{}',
  error_reason TEXT,
  result_hash TEXT,
  output_cid TEXT,
  encrypted_output_key_high TEXT,
  encrypted_output_key_low TEXT,
  rewards_distributed BOOLEAN DEFAULT FALSE,
  reward_tx_hashes TEXT[] DEFAULT '{}',
  rewards JSONB DEFAULT '{}',
  claim_result JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_inference_requests_status ON inference_requests(status);
CREATE INDEX IF NOT EXISTS idx_inference_requests_leader ON inference_requests(leader_address);
CREATE INDEX IF NOT EXISTS idx_inference_requests_task_id ON inference_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_node_runtimes_address ON node_runtimes(operator_address);
CREATE INDEX IF NOT EXISTS idx_operators_address ON operators(operator_address);
CREATE INDEX IF NOT EXISTS idx_credits_user ON credits(user_address);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_address);
CREATE INDEX IF NOT EXISTS idx_jobs_task_id ON jobs(task_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_verifier_verdicts_request ON verifier_verdicts(request_id);

-- ============================================
-- Atomic Credit Operations (RPC Functions)
-- ============================================

CREATE OR REPLACE FUNCTION atomic_credit_deduct(
    p_user_address TEXT,
    p_amount_cusdc NUMERIC,
    p_amount_blind NUMERIC
) RETURNS TABLE (
    balance_cusdc NUMERIC,
    balance_blind NUMERIC,
    total_spent_cusdc NUMERIC,
    total_spent_blind NUMERIC
) AS $$
DECLARE
    v_record RECORD;
BEGIN
    SELECT * INTO v_record FROM credits WHERE user_address = p_user_address FOR UPDATE;
    
    IF v_record IS NULL THEN
        RAISE EXCEPTION 'Credit account not found for %', p_user_address;
    END IF;
    
    IF v_record.balance_cusdc < p_amount_cusdc THEN
        RAISE EXCEPTION 'Insufficient cUSDC credits: have %, need %', v_record.balance_cusdc, p_amount_cusdc;
    END IF;
    
    IF v_record.balance_blind < p_amount_blind THEN
        RAISE EXCEPTION 'Insufficient BLIND credits: have %, need %', v_record.balance_blind, p_amount_blind;
    END IF;
    
    UPDATE credits 
    SET balance_cusdc = credits.balance_cusdc - p_amount_cusdc,
        balance_blind = credits.balance_blind - p_amount_blind,
        total_spent_cusdc = credits.total_spent_cusdc + p_amount_cusdc,
        total_spent_blind = credits.total_spent_blind + p_amount_blind,
        last_updated = NOW()
    WHERE credits.user_address = p_user_address;
    
    RETURN QUERY SELECT 
        credits.balance_cusdc, 
        credits.balance_blind, 
        credits.total_spent_cusdc, 
        credits.total_spent_blind 
    FROM credits 
    WHERE credits.user_address = p_user_address;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION atomic_credit_refund(
    p_user_address TEXT,
    p_amount_cusdc NUMERIC,
    p_amount_blind NUMERIC
) RETURNS TABLE (
    balance_cusdc NUMERIC,
    balance_blind NUMERIC,
    total_spent_cusdc NUMERIC,
    total_spent_blind NUMERIC
) AS $$
BEGIN
    UPDATE credits 
    SET balance_cusdc = credits.balance_cusdc + p_amount_cusdc,
        balance_blind = credits.balance_blind + p_amount_blind,
        total_spent_cusdc = GREATEST(0, credits.total_spent_cusdc - p_amount_cusdc),
        total_spent_blind = GREATEST(0, credits.total_spent_blind - p_amount_blind),
        last_updated = NOW()
    WHERE credits.user_address = p_user_address;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credit account not found for %', p_user_address;
    END IF;
    
    RETURN QUERY SELECT 
        credits.balance_cusdc, 
        credits.balance_blind, 
        credits.total_spent_cusdc, 
        credits.total_spent_blind 
    FROM credits 
    WHERE credits.user_address = p_user_address;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION atomic_credit_deposit(
    p_user_address TEXT,
    p_amount_cusdc NUMERIC,
    p_amount_blind NUMERIC
) RETURNS TABLE (
    out_balance_cusdc NUMERIC,
    out_balance_blind NUMERIC,
    out_total_deposited_cusdc NUMERIC,
    out_total_deposited_blind NUMERIC
) AS $$
BEGIN
    INSERT INTO credits (user_address, balance_cusdc, balance_blind, total_deposited_cusdc, total_deposited_blind)
    VALUES (p_user_address, p_amount_cusdc, p_amount_blind, p_amount_cusdc, p_amount_blind)
    ON CONFLICT (user_address) DO UPDATE
    SET balance_cusdc = credits.balance_cusdc + p_amount_cusdc,
        balance_blind = credits.balance_blind + p_amount_blind,
        total_deposited_cusdc = credits.total_deposited_cusdc + p_amount_cusdc,
        total_deposited_blind = credits.total_deposited_blind + p_amount_blind,
        last_updated = NOW();

    RETURN QUERY SELECT
        credits.balance_cusdc,
        credits.balance_blind,
        credits.total_deposited_cusdc,
        credits.total_deposited_blind
    FROM credits
    WHERE credits.user_address = p_user_address;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Disable RLS for testnet (all backend access)
-- ============================================

ALTER TABLE inference_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE quorum_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE verifier_verdicts DISABLE ROW LEVEL SECURITY;
ALTER TABLE quorum_certificates DISABLE ROW LEVEL SECURITY;
ALTER TABLE permits DISABLE ROW LEVEL SECURITY;
ALTER TABLE node_runtimes DISABLE ROW LEVEL SECURITY;
ALTER TABLE operators DISABLE ROW LEVEL SECURITY;
ALTER TABLE disputes DISABLE ROW LEVEL SECURITY;
ALTER TABLE model_catalog DISABLE ROW LEVEL SECURITY;
ALTER TABLE credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
