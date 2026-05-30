-- ============================================================
-- BHARATH FORKLIFT CMS - Complete Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- RBAC: Roles, Permissions, RolePermissions
-- ============================================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permission_name VARCHAR(100) UNIQUE NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  profile_image TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COMPANY SETTINGS
-- ============================================================

CREATE TABLE company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name VARCHAR(200) DEFAULT 'Bharath Forklift',
  logo_url TEXT,
  gst_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  contact_number VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  invoice_prefix VARCHAR(10) DEFAULT 'INV',
  quotation_prefix VARCHAR(10) DEFAULT 'QT',
  challan_prefix VARCHAR(10) DEFAULT 'DC',
  purchase_prefix VARCHAR(10) DEFAULT 'PO',
  default_tax_rate DECIMAL(5,2) DEFAULT 18.00,
  currency VARCHAR(10) DEFAULT 'INR',
  currency_symbol VARCHAR(5) DEFAULT '₹',
  invoice_terms TEXT DEFAULT 'Payment due within 30 days.',
  invoice_footer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code VARCHAR(20) UNIQUE,
  name VARCHAR(200) NOT NULL,
  mobile VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  gst_number VARCHAR(20),
  customer_type VARCHAR(20) CHECK (customer_type IN ('retail', 'dealer', 'corporate')) DEFAULT 'retail',
  credit_limit DECIMAL(15,2) DEFAULT 0,
  current_credit DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_code VARCHAR(20) UNIQUE,
  name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100),
  mobile VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  gst_number VARCHAR(20),
  products_supplied TEXT[],
  outstanding_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================

CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_code VARCHAR(50) UNIQUE,
  name VARCHAR(200) NOT NULL,
  category_id UUID REFERENCES product_categories(id),
  description TEXT,
  stock_quantity DECIMAL(15,3) DEFAULT 0,
  minimum_stock DECIMAL(15,3) DEFAULT 0,
  buying_price DECIMAL(15,2) DEFAULT 0,
  selling_price DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 18.00,
  unit VARCHAR(20) DEFAULT 'pcs',
  supplier_id UUID REFERENCES suppliers(id),
  product_image TEXT,
  hsn_code VARCHAR(20),
  stock_status VARCHAR(20) GENERATED ALWAYS AS (
    CASE
      WHEN stock_quantity <= 0 THEN 'out_of_stock'
      WHEN stock_quantity <= minimum_stock THEN 'low_stock'
      ELSE 'in_stock'
    END
  ) STORED,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- STOCK TRANSACTIONS
-- ============================================================

CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  quantity DECIMAL(15,3) NOT NULL,
  previous_stock DECIMAL(15,3) NOT NULL,
  new_stock DECIMAL(15,3) NOT NULL,
  transaction_type VARCHAR(20) CHECK (transaction_type IN ('sold', 'purchased', 'returned', 'adjusted')) NOT NULL,
  reference_type VARCHAR(20),
  reference_id UUID,
  buying_price DECIMAL(15,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  purchase_date DATE NOT NULL,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'partial', 'paid')) DEFAULT 'pending',
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity DECIMAL(15,3) NOT NULL,
  buying_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL
);

-- ============================================================
-- QUOTATIONS
-- ============================================================

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  quotation_date DATE NOT NULL,
  valid_until DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('draft', 'sent', 'converted', 'expired')) DEFAULT 'draft',
  terms TEXT,
  notes TEXT,
  converted_to_invoice UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(200),
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL
);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  quotation_id UUID REFERENCES quotations(id),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  pending_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status VARCHAR(20) CHECK (status IN ('paid', 'partial', 'pending', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name VARCHAR(200),
  quantity DECIMAL(15,3) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) NOT NULL
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id),
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50) CHECK (payment_method IN ('cash', 'upi', 'card', 'net_banking', 'credit', 'other')) NOT NULL,
  payment_note TEXT,
  reference_number VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================================
-- VEHICLES
-- ============================================================

CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_code VARCHAR(20) UNIQUE,
  vehicle_name VARCHAR(200) NOT NULL,
  forklift_type VARCHAR(100),
  registration_number VARCHAR(50) UNIQUE,
  model VARCHAR(100),
  year INTEGER,
  capacity VARCHAR(50),
  fuel_type VARCHAR(50),
  chassis_number VARCHAR(100),
  insurance_expiry DATE,
  vehicle_status VARCHAR(30) CHECK (vehicle_status IN ('available', 'rented', 'maintenance', 'sold')) DEFAULT 'available',
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- DELIVERY CHALLANS
-- ============================================================

CREATE TABLE delivery_challans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challan_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  vehicle_id UUID REFERENCES vehicles(id),
  challan_type VARCHAR(20) CHECK (challan_type IN ('rental', 'contract')) NOT NULL,
  challan_date DATE NOT NULL,
  -- Rental fields
  start_date DATE,
  end_date DATE,
  rent_amount DECIMAL(15,2),
  payment_date DATE,
  security_deposit DECIMAL(15,2),
  -- Contract fields
  contract_amount DECIMAL(15,2),
  payment_schedule VARCHAR(50),
  contract_notes TEXT,
  -- Common
  status VARCHAR(20) CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- MAINTENANCE
-- ============================================================

CREATE TABLE maintenance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  maintenance_number VARCHAR(50) UNIQUE,
  vehicle_id UUID REFERENCES vehicles(id),
  maintenance_date DATE NOT NULL,
  problem TEXT,
  parts_replaced TEXT,
  cost DECIMAL(15,2) DEFAULT 0,
  service_notes TEXT,
  next_service_date DATE,
  status VARCHAR(20) CHECK (status IN ('scheduled', 'in_progress', 'completed')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_customers_mobile ON customers(mobile);
CREATE INDEX idx_customers_deleted_at ON customers(deleted_at);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_stock_transactions_product ON stock_transactions(product_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_vehicles_status ON vehicles(vehicle_status);
CREATE INDEX idx_delivery_challans_customer ON delivery_challans(customer_id);
CREATE INDEX idx_maintenance_vehicle ON maintenance_records(vehicle_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================
-- SEED: Permissions
-- ============================================================

INSERT INTO permissions (permission_name, module, description) VALUES
  -- Dashboard
  ('view_dashboard', 'dashboard', 'View dashboard'),
  -- Customers
  ('create_customer', 'customers', 'Create customers'),
  ('edit_customer', 'customers', 'Edit customers'),
  ('delete_customer', 'customers', 'Delete customers'),
  ('view_customer', 'customers', 'View customers'),
  -- Suppliers
  ('create_supplier', 'suppliers', 'Create suppliers'),
  ('edit_supplier', 'suppliers', 'Edit suppliers'),
  ('delete_supplier', 'suppliers', 'Delete suppliers'),
  ('view_supplier', 'suppliers', 'View suppliers'),
  -- Products
  ('create_product', 'products', 'Create products'),
  ('edit_product', 'products', 'Edit products'),
  ('delete_product', 'products', 'Delete products'),
  ('restock_product', 'products', 'Restock products'),
  ('view_product', 'products', 'View products'),
  -- Purchase
  ('create_purchase', 'purchase', 'Create purchases'),
  ('edit_purchase', 'purchase', 'Edit purchases'),
  ('view_purchase', 'purchase', 'View purchases'),
  -- Quotations
  ('create_quotation', 'quotations', 'Create quotations'),
  ('edit_quotation', 'quotations', 'Edit quotations'),
  ('delete_quotation', 'quotations', 'Delete quotations'),
  ('view_quotation', 'quotations', 'View quotations'),
  -- Invoices
  ('create_invoice', 'invoices', 'Create invoices'),
  ('edit_invoice', 'invoices', 'Edit invoices'),
  ('view_invoice', 'invoices', 'View invoices'),
  -- Vehicles
  ('create_vehicle', 'vehicles', 'Create vehicles'),
  ('edit_vehicle', 'vehicles', 'Edit vehicles'),
  ('delete_vehicle', 'vehicles', 'Delete vehicles'),
  ('view_vehicle', 'vehicles', 'View vehicles'),
  -- Delivery Challans
  ('create_challan', 'delivery_challans', 'Create delivery challans'),
  ('edit_challan', 'delivery_challans', 'Edit delivery challans'),
  ('view_challan', 'delivery_challans', 'View delivery challans'),
  -- Maintenance
  ('create_maintenance', 'maintenance', 'Create maintenance records'),
  ('edit_maintenance', 'maintenance', 'Edit maintenance records'),
  ('view_maintenance', 'maintenance', 'View maintenance records'),
  -- Reports
  ('view_reports', 'reports', 'View reports'),
  -- Users
  ('manage_users', 'users', 'Manage users'),
  -- Settings
  ('manage_settings', 'settings', 'Manage settings');

-- ============================================================
-- SEED: Roles
-- ============================================================

INSERT INTO roles (role_name, description) VALUES
  ('admin', 'Full access to all modules'),
  ('sales', 'Access to sales related modules'),
  ('vehicle_manager', 'Access to vehicle and maintenance modules');

-- ============================================================
-- SEED: Role Permissions (Admin gets all)
-- ============================================================

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.role_name = 'admin';

-- Sales role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'sales'
AND p.permission_name IN (
  'view_dashboard',
  'view_customer', 'create_customer', 'edit_customer',
  'view_product', 'view_supplier',
  'create_purchase', 'edit_purchase', 'view_purchase',
  'create_quotation', 'edit_quotation', 'view_quotation', 'delete_quotation',
  'create_invoice', 'edit_invoice', 'view_invoice'
);

-- Vehicle Manager role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'vehicle_manager'
AND p.permission_name IN (
  'view_dashboard',
  'view_vehicle', 'create_vehicle', 'edit_vehicle', 'delete_vehicle',
  'create_challan', 'edit_challan', 'view_challan',
  'create_maintenance', 'edit_maintenance', 'view_maintenance'
);

-- ============================================================
-- SEED: Company Settings
-- ============================================================

INSERT INTO company_settings (company_name, gst_number, address, city, state, contact_number, email)
VALUES ('Bharath Forklift', '33XXXXX0000X1ZX', '123, Industrial Area', 'Coimbatore', 'Tamil Nadu', '+91 98765 43210', 'info@bharathforklift.com');

-- ============================================================
-- SEED: Product Categories
-- ============================================================

INSERT INTO product_categories (name) VALUES
  ('Spare Parts'),
  ('Tyres'),
  ('Batteries'),
  ('Hydraulic Components'),
  ('Electrical Components'),
  ('Engine Parts'),
  ('Accessories'),
  ('Lubricants');

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = auth_user_id);

-- Authenticated users can read all core data (permission checks done in app)
CREATE POLICY "Authenticated users can read customers" ON customers
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read suppliers" ON suppliers
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read products" ON products
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read invoices" ON invoices
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read quotations" ON quotations
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read vehicles" ON vehicles
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read challans" ON delivery_challans
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

CREATE POLICY "Authenticated users can read maintenance" ON maintenance_records
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- Write policies (service role handles all writes via API)
CREATE POLICY "Service role full access customers" ON customers
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access products" ON products
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access invoices" ON invoices
  USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to generate sequential codes
CREATE OR REPLACE FUNCTION generate_code(prefix TEXT, table_name TEXT, column_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  result TEXT;
BEGIN
  EXECUTE format('SELECT COALESCE(MAX(SUBSTRING(%I FROM %L)::INTEGER), 0) + 1 FROM %I',
    column_name, prefix || '([0-9]+)', table_name)
  INTO next_num;
  result := prefix || LPAD(next_num::TEXT, 6, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_challans_updated_at BEFORE UPDATE ON delivery_challans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_purchase_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
