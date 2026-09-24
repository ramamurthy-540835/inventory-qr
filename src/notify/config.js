'use strict';

// Single source of truth for every env var used by the archive + notify layer.
// Nothing here throws at import time: a missing channel just disables that channel,
// so an order is NEVER blocked by a missing secret.

const bool = (v, def = false) =>
  v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

const config = {
  project: process.env.GOOGLE_CLOUD_PROJECT || 'customer-grocery-507211',
  bucket: process.env.GCS_BUCKET || 'customer-grocery-507211-inventory-management',

  // BigQuery
  dataset: process.env.BQ_DATASET || 'inventory_management',
  notificationTable: process.env.BQ_NOTIFICATION_TABLE || 'notification_log',

  // Public app URL used in email / WhatsApp links
  appUrl: (process.env.APP_BASE_URL || 'https://nelture-grocery-foovqasysa-el.a.run.app/app/').replace(/\/+$/, '/'),

  brand: {
    name: process.env.BRAND_NAME || 'Nelture Grocery',
    supportEmail: process.env.SUPPORT_EMAIL || 'ai@nelture.ai',
    supportPhone: process.env.SUPPORT_PHONE || '',
    address: process.env.BRAND_ADDRESS || 'New No. 26, Siva Apartment, Kalaimagal 2nd Main, Chennai 600032',
  },

  archive: {
    enabled: bool(process.env.ARCHIVE_ENABLED, true),
    signedUrlDays: Number(process.env.SIGNED_URL_DAYS || 7),
  },

  email: {
    enabled: bool(process.env.EMAIL_ENABLED, true),
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool(process.env.SMTP_SECURE, false), // true only for port 465
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Nelture Grocery <ai@nelture.ai>',
    replyTo: process.env.MAIL_REPLY_TO || 'ai@nelture.ai',
    bcc: process.env.MAIL_BCC || '', // internal copy, optional
  },

  whatsapp: {
    enabled: bool(process.env.WHATSAPP_ENABLED, true),
    defaultCountryCode: process.env.WA_DEFAULT_CC || '91', // India
  },

  openclaw: {
    enabled: bool(process.env.OPENCLAW_ENABLED, true),
    url: (process.env.OPENCLAW_DELIVERY_URL || 'https://openclaw-delivery-foovqasysa-el.a.run.app/v1/whatsapp/documents').replace(/\/$/, ''),
    token: process.env.OPENCLAW_DELIVERY_TOKEN || '',
  },

  // Hard ceiling so checkout never hangs on a third party
  timeoutMs: Number(process.env.NOTIFY_TIMEOUT_MS || 30000),
};

config.email.configured = Boolean(config.email.enabled && config.email.host && config.email.user && config.email.pass);
config.whatsapp.configured = Boolean(config.whatsapp.enabled && config.openclaw.enabled && config.openclaw.token);

module.exports = config;
