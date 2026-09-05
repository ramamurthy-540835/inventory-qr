CREATE SCHEMA IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch`
OPTIONS(location = "asia-south1");

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.orders` (
  order_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  student_name STRING NOT NULL,
  school_name STRING NOT NULL,
  parent_phone STRING NOT NULL,
  city STRING NOT NULL,
  grade_band STRING NOT NULL,
  items_json JSON NOT NULL,
  total_inr NUMERIC NOT NULL,
  status STRING NOT NULL,
  receipt_uri STRING
)
PARTITION BY DATE(created_at)
CLUSTER BY city, school_name, status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.meal_packages` (
  meal_id STRING NOT NULL,
  service_date DATE NOT NULL,
  city STRING NOT NULL,
  grade_band STRING NOT NULL,
  meal_name STRING NOT NULL,
  diet_type STRING NOT NULL,
  allergens ARRAY<STRING>,
  calories INT64,
  protein_g NUMERIC,
  price_inr NUMERIC NOT NULL,
  image_gcs_uri STRING,
  is_available BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY service_date
CLUSTER BY city, grade_band, diet_type;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.marketing_locations` (
  location_id STRING NOT NULL,
  place_id STRING,
  name STRING NOT NULL,
  location_type STRING NOT NULL,
  address STRING NOT NULL,
  city STRING NOT NULL,
  latitude FLOAT64,
  longitude FLOAT64,
  phone STRING,
  website STRING,
  rating FLOAT64,
  reviews INT64,
  related_school_place_id STRING,
  distance_km FLOAT64,
  status STRING NOT NULL,
  saved_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(saved_at)
CLUSTER BY city, location_type, related_school_place_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.marketing_discovery_runs` (
  search_id STRING NOT NULL,
  searched_at TIMESTAMP NOT NULL,
  school_place_id STRING NOT NULL,
  school_name STRING NOT NULL,
  school_latitude FLOAT64,
  school_longitude FLOAT64,
  radius_km FLOAT64 NOT NULL,
  result_count INT64 NOT NULL
)
PARTITION BY DATE(searched_at)
CLUSTER BY school_place_id;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders`
ADD COLUMN IF NOT EXISTS parent_uid STRING;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders`
ADD COLUMN IF NOT EXISTS student_id STRING;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders`
ADD COLUMN IF NOT EXISTS allergies_json STRING;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.cities` (
  city_id STRING NOT NULL,
  city_name STRING NOT NULL,
  active BOOL NOT NULL,
  launch_date DATE,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY active, city_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.kitchens` (
  kitchen_id STRING NOT NULL,
  city_id STRING NOT NULL,
  kitchen_name STRING NOT NULL,
  daily_capacity INT64 NOT NULL,
  order_cutoff TIME NOT NULL,
  prep_lead_minutes INT64 NOT NULL,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY city_id, active;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.schools` (
  school_id STRING NOT NULL,
  city_id STRING NOT NULL,
  kitchen_id STRING NOT NULL,
  school_name STRING NOT NULL,
  area STRING NOT NULL,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY city_id, kitchen_id, active;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.delivery_routes` (
  route_id STRING NOT NULL,
  kitchen_id STRING NOT NULL,
  route_name STRING NOT NULL,
  driver_id STRING,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY kitchen_id, active;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.route_stops_daily` (
  service_date DATE NOT NULL,
  route_id STRING NOT NULL,
  stop_sequence INT64 NOT NULL,
  school_id STRING NOT NULL,
  planned_arrival TIME,
  delivered_at TIMESTAMP,
  proof_uri STRING,
  status STRING NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY service_date
CLUSTER BY route_id, school_id, status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.kitchen_capacity_daily` (
  service_date DATE NOT NULL,
  kitchen_id STRING NOT NULL,
  capacity_meals INT64 NOT NULL,
  confirmed_meals INT64 NOT NULL,
  pending_meals INT64,
  waitlisted_meals INT64 NOT NULL,
  cutoff_at TIMESTAMP NOT NULL,
  status STRING NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY service_date
CLUSTER BY kitchen_id, status;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.kitchen_capacity_daily`
ADD COLUMN IF NOT EXISTS pending_meals INT64;

-- Version 2 is the analytics-safe order model. The legacy orders table remains
-- available for migration/audit, but new application writes target orders_v2.
CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.orders_v2` (
  order_id STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  first_service_date DATE,
  last_service_date DATE,
  parent_ref STRING,
  student_ref STRING,
  school_id STRING NOT NULL,
  school_name STRING NOT NULL,
  kitchen_id STRING NOT NULL,
  city_id STRING NOT NULL,
  grade_band STRING NOT NULL,
  items ARRAY<STRUCT<
    meal_id STRING,
    meal_name STRING,
    service_date DATE,
    quantity INT64,
    unit_price_inr NUMERIC,
    line_total_inr NUMERIC
  >>,
  item_count INT64 NOT NULL,
  total_inr NUMERIC NOT NULL,
  currency STRING NOT NULL,
  order_status STRING NOT NULL,
  payment_status STRING NOT NULL,
  receipt_uri STRING,
  schema_version INT64 NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY city_id, school_id, order_status, payment_status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.menu_items` (
  meal_id STRING NOT NULL,
  service_date DATE NOT NULL,
  day_label STRING NOT NULL,
  short_date STRING NOT NULL,
  meal_name STRING NOT NULL,
  description STRING NOT NULL,
  tags ARRAY<STRING>,
  protein_g NUMERIC NOT NULL,
  calories INT64 NOT NULL,
  price_inr NUMERIC NOT NULL,
  rating NUMERIC NOT NULL,
  color STRING NOT NULL,
  emoji STRING NOT NULL,
  nutrition_status STRING NOT NULL,
  is_available BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
PARTITION BY service_date
CLUSTER BY is_available, nutrition_status, meal_id;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_lunch.grade_nutrition_plans` (
  grade_band STRING NOT NULL,
  label STRING NOT NULL,
  target_calories INT64 NOT NULL,
  target_protein_g NUMERIC NOT NULL,
  nutrition_status STRING NOT NULL,
  sort_order INT64 NOT NULL,
  active BOOL NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY active, sort_order, grade_band;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.schools`
ADD COLUMN IF NOT EXISTS price_tier STRING;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders_v2`
ADD COLUMN IF NOT EXISTS price_tier STRING;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders_v2`
ADD COLUMN IF NOT EXISTS free_meals ARRAY<STRUCT<
  meal_id STRING,
  meal_name STRING,
  service_date DATE,
  free_meal_type STRING,
  quantity INT64,
  subsidy_unit_inr NUMERIC,
  subsidy_total_inr NUMERIC
>>;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders_v2`
ADD COLUMN IF NOT EXISTS free_meal_count INT64;

ALTER TABLE `YOUR_PROJECT_ID.school_lunch.orders_v2`
ADD COLUMN IF NOT EXISTS free_meal_daily_cap INT64;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_lunch.free_meal_summary` AS
SELECT
  orders.kitchen_id,
  orders.city_id,
  orders.school_id,
  free_meal.service_date,
  DATE_TRUNC(free_meal.service_date, MONTH) AS service_month,
  free_meal.free_meal_type,
  SUM(free_meal.quantity) AS free_meals,
  SUM(free_meal.subsidy_total_inr) AS subsidy_cost_inr
FROM `YOUR_PROJECT_ID.school_lunch.orders_v2` AS orders,
UNNEST(IFNULL(orders.free_meals, [])) AS free_meal
WHERE orders.order_status NOT IN ("PAYMENT_EXPIRED", "REFUNDED", "REFUND_REQUESTED")
GROUP BY kitchen_id, city_id, school_id, service_date, service_month, free_meal_type;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_lunch.daily_free_meal_cap_usage` AS
SELECT
  kitchen_id,
  service_date,
  SUM(free_meals) AS free_meals_used,
  25 AS daily_cap,
  GREATEST(0, 25 - SUM(free_meals)) AS remaining_meals,
  SUM(subsidy_cost_inr) AS subsidy_cost_inr,
  SUM(free_meals) >= 25 AS cap_reached
FROM `YOUR_PROJECT_ID.school_lunch.free_meal_summary`
GROUP BY kitchen_id, service_date;
