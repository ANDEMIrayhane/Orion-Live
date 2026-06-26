-- ====================================================================
-- ORION LIVE - PRODUCTION SQL SCHEMA (Neon PostgreSQL)
-- Product: Orion Live SaaS MVP (Admin + Seller Multi-Tenant)
-- Author: Orion Live DevOps
-- Date: 2026-06-25
-- ====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 1. USERS TABLE (Admin & Sellers with Role Control)
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'SELLER' NOT NULL, -- 'ADMIN', 'SELLER'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_user_role CHECK (role IN ('ADMIN', 'SELLER'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ====================================================================
-- 2. LIVE_SESSIONS TABLE (With 24h constraint fields)
-- ====================================================================
CREATE TABLE IF NOT EXISTS live_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150) NOT NULL,
    description TEXT,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'DRAFT' NOT NULL, -- 'DRAFT', 'ACTIVE', 'INACTIVE', 'ENDED', 'SOLD_OUT'
    slug VARCHAR(100) UNIQUE NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_live_status CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ENDED', 'SOLD_OUT')),
    -- Ensure active live duration cannot exceed 24 hours
    CONSTRAINT chk_live_duration_24h CHECK (
        start_date IS NULL OR end_date IS NULL OR 
        (end_date - start_date <= INTERVAL '24 hours')
    )
);

CREATE INDEX IF NOT EXISTS idx_lives_slug ON live_sessions(slug);
CREATE INDEX IF NOT EXISTS idx_lives_user_status ON live_sessions(user_id, status);

-- ====================================================================
-- 3. PRODUCTS TABLE (Inventory management)
-- ====================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_product_stock CHECK (stock >= 0),
    CONSTRAINT chk_product_price CHECK (price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);

-- ====================================================================
-- 4. LIVE_PRODUCTS TABLE (Many-to-Many Association)
-- ====================================================================
CREATE TABLE IF NOT EXISTS live_products (
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    PRIMARY KEY (live_session_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_products_prod ON live_products(product_id);

-- ====================================================================
-- 5. VISITOR_SESSIONS TABLE (Anonymized active tracking)
-- ====================================================================
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pseudo VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(30), -- Optional WhatsApp contact for purchase validation
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visitor_live_pseudo ON visitor_sessions(live_session_id, pseudo);

-- ====================================================================
-- 6. PRODUCT_INTERESTS TABLE (Public signals)
-- ====================================================================
CREATE TABLE IF NOT EXISTS product_interests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_pseudo VARCHAR(50) NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_interests_live_prod ON product_interests(live_session_id, product_id);

-- ====================================================================
-- 7. RESERVATIONS TABLE (Atomic purchase intentions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_pseudo VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(30), -- Optional WhatsApp contact for seller followup
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_reservation_qty CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_reservations_live_prod ON reservations(live_session_id, product_id);

-- ====================================================================
-- 8. AUDIT_LOGS TABLE (Real-time live monitoring metrics)
-- ====================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    visitor_pseudo VARCHAR(50) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'join', 'interest', 'reservation'
    product_name VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_live_time ON audit_logs(live_session_id, created_at DESC);

-- ====================================================================
-- AUTOMATIC PROCEDURES FOR AUTO-EXPIRATION & STOCK STATUSES
-- ====================================================================

-- Trigger to automatically handle live_sessions update timestamps
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER tg_update_live_sessions_timestamp
BEFORE UPDATE ON live_sessions
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER tg_update_products_timestamp
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();
