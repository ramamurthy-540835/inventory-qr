# Wiring: GCS order archive + email + WhatsApp

Project `customer-grocery-507211` · region `asia-south1` · service `nelture-grocery`

## 1. What lands in the bucket

```
orders/YYYY/MM/DD/<order_id>/order.json      immutable snapshot, money as strings
orders/YYYY/MM/DD/<order_id>/receipt.html    same HTML the customer receives
orders/YYYY/MM/DD/<order_id>/qr.png          copy of qr-codes/<qr_id>.png
orders/_sent/<order_id>/email.json           idempotency marker
orders/_sent/<order_id>/whatsapp.json        idempotency marker
```

Existing prefixes (`materials/`, `inventory/`, `customers/`, `invoices/`, `qr-codes/`, `backups/`) are untouched.

Set a lifecycle rule so receipts don't accumulate forever:

```bash
cat > lifecycle.json <<'EOF'
{"lifecycle":{"rule":[
 {"action":{"type":"SetStorageClass","storageClass":"NEARLINE"},
  "condition":{"age":90,"matchesPrefix":["orders/"]}},
 {"action":{"type":"Delete"},
  "condition":{"age":30,"matchesPrefix":["orders/_sent/"]}}
]}}
EOF
gcloud storage buckets update gs://customer-grocery-507211-inventory-management --lifecycle-file=lifecycle.json
```

## 2. IAM

The runtime service account already needs `roles/bigquery.dataEditor`, `roles/bigquery.jobUser`, `roles/storage.objectAdmin`. Add one more so V4 signed URLs (the QR image + receipt link inside the email) can be generated:

```bash
SA=$(gcloud run services describe nelture-grocery --region asia-south1 --format='value(spec.template.spec.serviceAccountName)')
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountTokenCreator"
```

Without this the email still sends — the QR block is just omitted.

## 3. Secrets

```bash
for S in SMTP_PASS WA_ACCESS_TOKEN; do
  gcloud secrets create $S --replication-policy=automatic 2>/dev/null || true
done
printf '%s' 'YOUR_SMTP_APP_PASSWORD' | gcloud secrets versions add SMTP_PASS --data-file=-
printf '%s' 'YOUR_META_PERMANENT_TOKEN' | gcloud secrets versions add WA_ACCESS_TOKEN --data-file=-

gcloud secrets add-iam-policy-binding SMTP_PASS \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding WA_ACCESS_TOKEN \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

Never put the token in `.env`, the README, or a commit. Use a **permanent** System User token from Meta Business Manager, not the 24-hour test token from the dashboard.

## 4. Deploy

```bash
gcloud run deploy nelture-grocery \
  --source . --region asia-south1 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=aidirac-503309,\
GCS_BUCKET=aidirac-503309-inventory-management,\
BQ_DATASET=inventory_management,\
APP_BASE_URL=https://nelture-grocery-foovqasysa-el.a.run.app/app/,\
BRAND_NAME=Nelture Grocery,\
SUPPORT_EMAIL=ai@nelture.ai,\
MAIL_FROM=Nelture Grocery <ai@nelture.ai>,\
SMTP_HOST=smtp-relay.brevo.com,SMTP_PORT=587,SMTP_USER=ai@nelture.ai,\
OPENCLAW_DELIVERY_URL=https://openclaw-delivery-foovqasysa-el.a.run.app/v1/whatsapp/documents,\
EMAIL_ENABLED=true,WHATSAPP_ENABLED=true,OPENCLAW_ENABLED=true,NOTIFY_TIMEOUT_MS=30000" \
  --set-secrets "SMTP_PASS=SMTP_PASS:latest,OPENCLAW_DELIVERY_TOKEN=openclaw-delivery-token:latest"
```

Kill switches: `EMAIL_ENABLED=false` / `WHATSAPP_ENABLED=false` disable a channel without a code change. Unset secrets = channel logs `skipped`, order still completes.

## 5. SMTP choice

| Option | Notes |
|---|---|
| Brevo (`smtp-relay.brevo.com:587`) | 300 free/day, no card, works from India, fastest to stand up |
| Amazon SES (`email-smtp.ap-south-1.amazonaws.com:587`) | cheapest at volume, sandbox until you request production access |
| Gmail app password (`smtp.gmail.com:587`) | fine for smoke tests only — poor deliverability for transactional volume |

Whichever you pick, add SPF + DKIM records for `nelture.ai` before real traffic, or the receipts land in spam.

## 6. WhatsApp — the part with lead time

An order confirmation is business-initiated, so it must go out on a **pre-approved template**, not free text. Submit this in Meta Business Manager → WhatsApp Manager → Message templates:

- **Name:** `order_confirmation`
- **Category:** Utility (not Marketing — Utility is cheaper and approves faster)
- **Language:** English
- **Body:**
  `Hi {{1}}, your {{2}} order {{3}} is confirmed. Amount paid: {{4}}. We'll notify you when it's out for delivery.`
- **Sample values:** `Anuradha` · `Nelture Grocery` · `ORD-053f08ef-601f-4d78-8ed7-ec8b849d839f` · `Rs 1,240.00`
- **Footer (optional):** `Reply STOP to opt out.`

`src/notify/templates.js → whatsappParams()` already supplies those four parameters in that order. If you change the template wording, change the parameter count to match or Meta returns error 132000.

Prerequisites before the first send: a verified Meta Business account, a WhatsApp Business phone number (a number not already on the consumer WhatsApp app), and the Phone Number ID from the API setup screen. Approval is usually hours, occasionally a day or two — start this now, it's the long pole.

Also: Meta requires opt-in. Add a checkbox at checkout — "Send order updates to my WhatsApp number" — and store the consent flag on the customer row. That's both a policy requirement and DPDP Act hygiene.

## 7. WhatsApp through OpenClaw

The backend sends the generated `80g.pdf` to the existing authenticated OpenClaw bridge at `POST /v1/whatsapp/documents` with the registered phone number, filename, base64 PDF, and caption. The delivery token belongs in Secret Manager only. OpenClaw must already have a linked WhatsApp session.

The customer-facing success page reads the notification audit record and shows the actual registered number used for delivery.

## 8. Smoke test

```bash
# after deploy, with an order that exists
curl -X POST https://nelture-grocery-foovqasysa-el.a.run.app/orders/ORD-053f08ef-601f-4d78-8ed7-ec8b849d839f/resend-confirmation \
  -H "x-admin-token: $ADMIN_TOKEN"
```

Expected: `email=sent whatsapp=sent`, two rows in `notification_log`, and `order.json`, `receipt.html`, `80g.pdf`, and `qr.png` under `orders/2026/09/19/<order_id>/`.

## 9. Still open on this repo

- Branded domain in front of the raw `run.app` URL — a grocery checkout emailing links from `foovqasysa-el.a.run.app` reads as phishing to most customers and to Gmail's spam filter. Point `grocery.nelture.ai` at the service and set `APP_BASE_URL` to it before any real traffic.
- The repo is public with a live GCP project ID in the README. Nothing secret there by itself, but audit the history for any credential before you promote this.
