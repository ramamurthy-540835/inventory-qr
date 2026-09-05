CREATE SCHEMA IF NOT EXISTS `YOUR_PROJECT_ID.school_directory`
OPTIONS(location = "asia-south1");

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.school_master` (
  school_id STRING NOT NULL,
  school_name STRING NOT NULL,
  city_code STRING NOT NULL,
  zone_code STRING NOT NULL,
  locality STRING,
  postal_code STRING,
  latitude FLOAT64,
  longitude FLOAT64,
  provider STRING NOT NULL,
  private_status STRING NOT NULL,
  confidence FLOAT64,
  school_board STRING,
  classes_from STRING,
  classes_to STRING,
  student_strength_total INT64,
  student_strength_6_12 INT64,
  website STRING,
  phone STRING,
  email STRING,
  principal_name STRING,
  school_management_type STRING,
  estimated_lunch_students INT64,
  franchise_id STRING,
  territory_id STRING,
  territory_manager STRING,
  last_verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
CLUSTER BY city_code, zone_code, private_status, provider;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.school_search_events` (
  event_timestamp TIMESTAMP NOT NULL,
  city_code STRING NOT NULL,
  zone_code STRING,
  query_prefix STRING NOT NULL,
  result_count INT64 NOT NULL,
  provider_used STRING NOT NULL,
  cache_hit BOOL NOT NULL,
  latency_ms INT64 NOT NULL
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY city_code, zone_code, provider_used;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.school_registration_events` (
  event_timestamp TIMESTAMP NOT NULL,
  school_id STRING NOT NULL,
  city_code STRING NOT NULL,
  zone_code STRING NOT NULL,
  registration_source STRING NOT NULL
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY city_code, zone_code;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.school_provider_usage` (
  event_timestamp TIMESTAMP NOT NULL,
  provider STRING NOT NULL,
  success BOOL NOT NULL,
  latency_ms INT64 NOT NULL,
  result_count INT64 NOT NULL
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY provider, success;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.school_zone_summary` AS
SELECT city_code, zone_code, COUNT(*) AS school_count,
  COUNTIF(private_status = "verified") AS verified_school_count,
  COUNTIF(franchise_id IS NOT NULL) AS franchise_covered_school_count,
  SUM(student_strength_total) AS known_student_strength,
  SUM(estimated_lunch_students) AS estimated_lunch_students
FROM `YOUR_PROJECT_ID.school_directory.school_master`
GROUP BY city_code, zone_code;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.schools_by_city` AS
SELECT city_code, COUNT(*) AS school_count
FROM `YOUR_PROJECT_ID.school_directory.school_master`
GROUP BY city_code;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.schools_by_zone` AS
SELECT city_code, zone_code, COUNT(*) AS school_count
FROM `YOUR_PROJECT_ID.school_directory.school_master`
GROUP BY city_code, zone_code;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.school_search_popularity` AS
SELECT city_code, zone_code, query_prefix, COUNT(*) AS search_count,
  AVG(result_count) AS average_result_count, AVG(latency_ms) AS average_latency_ms
FROM `YOUR_PROJECT_ID.school_directory.school_search_events`
GROUP BY city_code, zone_code, query_prefix;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.registered_schools` AS
SELECT school_id, city_code, zone_code, COUNT(*) AS registration_count, MAX(event_timestamp) AS last_registration_at
FROM `YOUR_PROJECT_ID.school_directory.school_registration_events`
GROUP BY school_id, city_code, zone_code;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.schools_without_student_strength` AS
SELECT * FROM `YOUR_PROJECT_ID.school_directory.school_master`
WHERE student_strength_total IS NULL;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.potential_franchise_territories` AS
SELECT city_code, zone_code, COUNT(*) AS school_count,
  SUM(student_strength_total) AS known_students,
  SAFE_DIVIDE(SUM(student_strength_total), 1500) AS indicative_franchise_capacity
FROM `YOUR_PROJECT_ID.school_directory.school_master`
WHERE franchise_id IS NULL
GROUP BY city_code, zone_code;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.office_master` (
  office_id STRING NOT NULL, display_name STRING NOT NULL, formatted_address STRING,
  city_code STRING NOT NULL, zone_code STRING NOT NULL, locality STRING, postal_code STRING,
  latitude FLOAT64, longitude FLOAT64, provider STRING NOT NULL, verification_status STRING NOT NULL,
  confidence FLOAT64, category STRING, company_id STRING, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
) CLUSTER BY city_code, zone_code, verification_status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.company_master` (
  company_id STRING NOT NULL, display_name STRING NOT NULL, formatted_address STRING,
  city_code STRING NOT NULL, zone_code STRING NOT NULL, locality STRING, postal_code STRING,
  latitude FLOAT64, longitude FLOAT64, provider STRING NOT NULL, verification_status STRING NOT NULL,
  confidence FLOAT64, category STRING, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
) CLUSTER BY city_code, zone_code, verification_status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.college_master` (
  college_id STRING NOT NULL, display_name STRING NOT NULL, formatted_address STRING,
  city_code STRING NOT NULL, zone_code STRING NOT NULL, locality STRING, postal_code STRING,
  latitude FLOAT64, longitude FLOAT64, provider STRING NOT NULL, verification_status STRING NOT NULL,
  confidence FLOAT64, category STRING, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL
) CLUSTER BY city_code, zone_code, verification_status;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.entity_search_events` (
  event_timestamp TIMESTAMP NOT NULL, entity_type STRING NOT NULL, city_code STRING NOT NULL, zone_code STRING,
  query_prefix STRING NOT NULL, result_count INT64 NOT NULL, provider_used STRING NOT NULL, cache_hit BOOL NOT NULL, latency_ms INT64 NOT NULL
) PARTITION BY DATE(event_timestamp) CLUSTER BY entity_type, city_code, zone_code;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.entity_provider_usage` (
  event_timestamp TIMESTAMP NOT NULL, entity_type STRING NOT NULL, provider STRING NOT NULL,
  success BOOL NOT NULL, latency_ms INT64 NOT NULL, result_count INT64 NOT NULL
) PARTITION BY DATE(event_timestamp) CLUSTER BY entity_type, provider, success;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.office_registration_events` (
  event_timestamp TIMESTAMP NOT NULL, office_id STRING NOT NULL, city_code STRING NOT NULL,
  zone_code STRING NOT NULL, registration_source STRING NOT NULL
) PARTITION BY DATE(event_timestamp) CLUSTER BY city_code, zone_code;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.company_registration_events` (
  event_timestamp TIMESTAMP NOT NULL, company_id STRING NOT NULL, city_code STRING NOT NULL,
  zone_code STRING NOT NULL, registration_source STRING NOT NULL
) PARTITION BY DATE(event_timestamp) CLUSTER BY city_code, zone_code;

CREATE TABLE IF NOT EXISTS `YOUR_PROJECT_ID.school_directory.college_registration_events` (
  event_timestamp TIMESTAMP NOT NULL, college_id STRING NOT NULL, city_code STRING NOT NULL,
  zone_code STRING NOT NULL, registration_source STRING NOT NULL
) PARTITION BY DATE(event_timestamp) CLUSTER BY city_code, zone_code;

CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.offices_by_city` AS
SELECT city_code, COUNT(*) office_count FROM `YOUR_PROJECT_ID.school_directory.office_master` GROUP BY city_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.offices_by_zone` AS
SELECT city_code, zone_code, COUNT(*) office_count FROM `YOUR_PROJECT_ID.school_directory.office_master` GROUP BY city_code, zone_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.companies_by_city` AS
SELECT city_code, COUNT(*) company_count FROM `YOUR_PROJECT_ID.school_directory.company_master` GROUP BY city_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.colleges_by_city` AS
SELECT city_code, COUNT(*) college_count FROM `YOUR_PROJECT_ID.school_directory.college_master` GROUP BY city_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.colleges_by_zone` AS
SELECT city_code, zone_code, COUNT(*) college_count FROM `YOUR_PROJECT_ID.school_directory.college_master` GROUP BY city_code, zone_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.franchise_office_coverage` AS
SELECT city_code, zone_code, COUNT(*) office_count, COUNTIF(company_id IS NOT NULL) linked_company_offices
FROM `YOUR_PROJECT_ID.school_directory.office_master` GROUP BY city_code, zone_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.corporate_conversion_pipeline` AS
SELECT city_code, zone_code, COUNT(*) registrations
FROM `YOUR_PROJECT_ID.school_directory.company_registration_events` GROUP BY city_code, zone_code;
CREATE OR REPLACE VIEW `YOUR_PROJECT_ID.school_directory.potential_meals_by_zone` AS
WITH territories AS (
  SELECT city_code, zone_code FROM `YOUR_PROJECT_ID.school_directory.school_master`
  UNION DISTINCT SELECT city_code, zone_code FROM `YOUR_PROJECT_ID.school_directory.office_master`
  UNION DISTINCT SELECT city_code, zone_code FROM `YOUR_PROJECT_ID.school_directory.company_master`
  UNION DISTINCT SELECT city_code, zone_code FROM `YOUR_PROJECT_ID.school_directory.college_master`
)
SELECT city_code, zone_code,
  (SELECT SUM(estimated_lunch_students) FROM `YOUR_PROJECT_ID.school_directory.school_master` s WHERE s.city_code=t.city_code AND s.zone_code=t.zone_code) schools_meals,
  CAST(NULL AS INT64) office_meals, CAST(NULL AS INT64) company_meals,
  CAST(NULL AS INT64) college_meals, CAST(NULL AS INT64) combined_meals
FROM territories t;
