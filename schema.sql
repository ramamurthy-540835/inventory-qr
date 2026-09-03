-- Run with: bq query --use_legacy_sql=false < schema.sql
CREATE SCHEMA IF NOT EXISTS `customer-grocery-507211.inventory_management`
OPTIONS(location = 'asia-south1', description = 'Inventory, customer, and order management data');

CREATE TABLE IF NOT EXISTS `customer-grocery-507211.inventory_management.materials` (
  material_id STRING NOT NULL,
  material_name STRING NOT NULL,
  material_date DATE,
  price NUMERIC,
  quantity NUMERIC,
  unit STRING,
  price_per_kg NUMERIC,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY material_id, material_name;

CREATE TABLE IF NOT EXISTS `customer-grocery-507211.inventory_management.inventory_stock` (
  stock_id STRING NOT NULL,
  material_id STRING,
  material_name STRING,
  category STRING,
  quantity NUMERIC,
  unit STRING,
  price NUMERIC,
  rate_per_kg NUMERIC,
  stock_date DATE,
  packing_date DATE,
  expiry_date DATE,
  status STRING,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY category, status;

CREATE TABLE IF NOT EXISTS `customer-grocery-507211.inventory_management.customers` (
  customer_id STRING NOT NULL,
  customer_name STRING NOT NULL,
  phone_number STRING,
  email STRING,
  address STRING,
  postal_code STRING,
  city STRING,
  state STRING,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY customer_id, postal_code;

CREATE TABLE IF NOT EXISTS `customer-grocery-507211.inventory_management.orders` (
  order_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  customer_name STRING,
  order_date TIMESTAMP NOT NULL,
  product_name STRING,
  quantity NUMERIC,
  unit STRING,
  price_per_unit NUMERIC,
  total_amount NUMERIC,
  postal_code STRING,
  delivery_address STRING,
  order_status STRING,
  payment_status STRING,
  inventory_stock_id STRING,
  razorpay_payment_link_id STRING,
  razorpay_payment_link_status STRING,
  razorpay_payment_id STRING,
  payment_link_url STRING,
  payment_received_at TIMESTAMP,
  inventory_committed_at TIMESTAMP,
  qr_id STRING NOT NULL,
  qr_image_gcs_uri STRING,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(order_date)
CLUSTER BY customer_id, order_status;

-- Safe migration for an existing installation created with an earlier schema.
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS inventory_stock_id STRING;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS razorpay_payment_link_id STRING;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS razorpay_payment_link_status STRING;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS razorpay_payment_id STRING;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS payment_link_url STRING;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP;
ALTER TABLE `customer-grocery-507211.inventory_management.orders` ADD COLUMN IF NOT EXISTS inventory_committed_at TIMESTAMP;

-- Useful BigQuery queries
-- Customer orders: SELECT * FROM `customer-grocery-507211.inventory_management.orders` WHERE customer_id = @customer_id ORDER BY order_date DESC;
-- Available inventory: SELECT * FROM `customer-grocery-507211.inventory_management.inventory_stock` WHERE status = 'AVAILABLE' ORDER BY expiry_date;

-- Sample inserts (production writes should use the API so IDs and timestamps are generated safely):
-- INSERT INTO `customer-grocery-507211.inventory_management.materials` VALUES ('MAT-001','Basmati Rice',CURRENT_DATE(),100.00,50,'KG',2.00,CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP());
-- INSERT INTO `customer-grocery-507211.inventory_management.customers` VALUES ('CUS001','Example Customer','9876543210','customer@example.com','10 Market Road','600001','Chennai','Tamil Nadu',CURRENT_TIMESTAMP(),CURRENT_TIMESTAMP());
