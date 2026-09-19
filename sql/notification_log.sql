-- Additive only. Does not touch any existing table in schema.sql.
-- Run: bq query --use_legacy_sql=false < sql/notification_log.sql

CREATE TABLE IF NOT EXISTS `customer-grocery-507211.inventory_management.notification_log` (
  notification_id    STRING   NOT NULL,
  order_id           STRING   NOT NULL,
  customer_id        STRING,
  channel            STRING   NOT NULL,   -- 'email' | 'whatsapp'
  recipient          STRING,
  status             STRING   NOT NULL,   -- 'sent' | 'skipped' | 'failed'
  provider_reference STRING,              -- SMTP message-id / WA message id
  error_message      STRING,
  gcs_prefix         STRING,              -- orders/YYYY/MM/DD/<order_id>
  created_at         TIMESTAMP NOT NULL
)
PARTITION BY DATE(created_at)
CLUSTER BY order_id, channel
OPTIONS (description = 'Delivery audit for order confirmation email + WhatsApp');

-- Orders that were paid but never successfully notified on a channel.
CREATE OR REPLACE VIEW `customer-grocery-507211.inventory_management.v_notification_failures` AS
SELECT
  order_id,
  channel,
  ANY_VALUE(recipient)      AS recipient,
  COUNT(*)                  AS attempts,
  MAX(created_at)           AS last_attempt,
  ARRAY_AGG(error_message IGNORE NULLS ORDER BY created_at DESC LIMIT 1)[SAFE_OFFSET(0)] AS last_error
FROM `customer-grocery-507211.inventory_management.notification_log`
WHERE created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY order_id, channel
HAVING LOGICAL_AND(status != 'sent');
