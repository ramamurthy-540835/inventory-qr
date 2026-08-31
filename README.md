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

`POST /materials`, `PATCH /materials/:id/price`, `POST /inventory`, `PATCH /inventory/:id/quantity`, `POST /customers`, `POST /orders`, `PATCH /orders/:id/status`, `POST /exports/:tableName`.

The service rejects duplicate customer IDs, never exposes a customer-ID update route, creates UUID-based material/stock/order IDs, and makes each QR ID from a five-letter customer/order hash + a microsecond sequence + a postcode-derived two-letter location code. It verifies QR uniqueness before insert and uploads the PNG to `qr-codes/`.

Grant the deployed service account `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`, and `roles/storage.objectAdmin` scoped to this dataset/bucket.
