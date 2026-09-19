# Payment, 80G, and WhatsApp Flow

This document describes the implementation plan for sending a customer their payment confirmation and 80G document after a successful payment.

## Flow

1. Razorpay confirms payment on the backend using server-side signature verification.
2. The backend creates or updates the order as `PAID`, then moves it to `PROCESSING`.
3. The order ID, Razorpay payment ID, customer UID, registered phone number, amount, and timestamps are written to BigQuery.
4. The backend generates the 80G PDF/receipt for the paid order.
5. The PDF is stored in Google Cloud Storage under:

   `customers/{customer_uid}/orders/{order_id}/80g.pdf`

6. WhatsApp, through OpenClaw, sends the registered phone number:
   - payment confirmation
   - order ID and amount
   - processing status
   - a time-limited signed GCS URL or the PDF attachment
7. The order and notification status are available in the customer's My Orders view.

## Backend storage

- **BigQuery:** orders, payment identifiers, customer UID mapping, document path, notification attempts, delivery status, and timestamps.
- **Firestore:** customer profile, registered phone number, application-facing order metadata, and notification status used by the UI.
- **Cloud Storage:** generated 80G PDFs. The bucket remains private; access is provided with short-lived signed URLs.
- **Secret Manager:** Razorpay credentials, OpenClaw credentials or gateway configuration, and GCS configuration. No credentials belong in frontend code.

## Reliability and security

- Use the Razorpay payment ID and order ID as an idempotency key so retries cannot create duplicate orders or documents.
- Generate the 80G document only after verified payment and persist its GCS object path.
- Keep document generation and WhatsApp delivery retryable and independent from order creation.
- Record each notification attempt and provider response in BigQuery.
- A WhatsApp failure must not roll back a paid order; it should mark delivery as pending or failed for retry.
- Validate and normalize the customer's registered phone number on the backend.

## OpenClaw deployment prerequisite

The locally linked OpenClaw WhatsApp gateway cannot be called from Cloud Run while it is bound only to localhost. Before production delivery is enabled, expose OpenClaw through a secured `wss://` endpoint or deploy a managed worker beside the application. Authenticate Cloud Run requests, restrict the endpoint, and keep the linked WhatsApp account credentials in Secret Manager.

## Verification checklist

- Complete a Razorpay test payment and verify the signature.
- Confirm the order, customer UID, and payment ID in BigQuery.
- Confirm the 80G PDF exists at the customer's GCS path and is not publicly writable.
- Confirm the My Orders view shows the generated order ID.
- Confirm OpenClaw delivers the message to the same registered phone number.
- Retry the callback and verify that no duplicate order, PDF, or WhatsApp message is created.
- Deploy to Cloud Run and repeat the complete test with production configuration.
