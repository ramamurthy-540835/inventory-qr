CREATE TABLE IF NOT EXISTS `aidirac-503309.grocery_analytics.product_images` (
  file_id STRING NOT NULL,
  original_filename STRING NOT NULL,
  stored_filename STRING NOT NULL,
  location STRING NOT NULL,
  description STRING NOT NULL,
  content_type STRING NOT NULL,
  size_bytes INT64 NOT NULL,
  gcs_uri STRING NOT NULL,
  public_url STRING NOT NULL,
  uploaded_by STRING NOT NULL,
  created_at TIMESTAMP NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY location, file_id;
