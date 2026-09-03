# Inventory management backend

## Provision

Set the active project and create the resources. The bucket name must be globally unique; change it if this one is taken.

```powershell
gcloud config set project customer-grocery-507211
bq query --use_legacy_sql=false < schema.sql
gcloud storage buckets create gs://customer-grocery-507211-inventory-management --location=asia-south1 --uniform-bucket-level-access
@('materials','inventory','customers','orders','invoices','qr-codes','backups') | ForEach-Object { gcloud storage folders create "gs://customer-grocery-507211-inventory-management/$($_)/" }
npm install
$env:GOOGLE_CLOUD_PROJECT='customer-grocery-507211'; $env:GCS_BUCKET='customer-grocery-507211-inventory-management'; npm start
```

The bucket folders are prefixes (not physical directories): `materials/`, `inventory/`, `customers/`, `orders/`, `invoices/`, `qr-codes/`, and `backups/`.

## API

`POST /materials`, `PATCH /materials/:id/price`, `POST /inventory`, `PATCH /inventory/:id/quantity`, `POST /customers`, `POST /orders`, `POST /checkout/orders`, `POST /webhooks/razorpay`, `GET /orders/:id/payment-status`, `PATCH /orders/:id/status`, `POST /exports/:tableName`.

The service rejects duplicate customer IDs, never exposes a customer-ID update route, creates UUID-based material/stock/order IDs, and makes each QR ID from a five-letter customer/order hash + a microsecond sequence + a postcode-derived two-letter location code. It verifies QR uniqueness before insert and uploads the PNG to `qr-codes/`.

Grant the deployed service account `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`, and `roles/storage.objectAdmin` scoped to this dataset/bucket.

## Razorpay payment links

Set these Cloud Run environment variables (never send the key secret to a browser):

```powershell
$env:RAZORPAY_KEY_ID='rzp_live_...'
$env:RAZORPAY_KEY_SECRET='...'
$env:RAZORPAY_WEBHOOK_SECRET='...'
$env:RAZORPAY_CALLBACK_URL='https://YOUR-SERVICE/payments/razorpay/callback'
```

In Razorpay Dashboard, create a webhook pointing to `https://YOUR-SERVICE/webhooks/razorpay`, configure the same webhook secret, and subscribe to `payment_link.paid`.

Your checkout calls `POST /checkout/orders` with the normal order fields plus `total_amount` and, when stock must be committed, `inventory_stock_id`. The response contains `payment_link_url`; redirect the customer there. Razorpay redirects the browser to the callback URL with the payment-link ID; it returns the customer confirmation message after the webhook processes it. Razorpay's signed `payment_link.paid` webhook marks the order `PAID` and `PROCESSING`, deducts the requested stock in the same BigQuery transaction, and replies with the confirmation message. Repeated webhook deliveries do not deduct inventory again.
