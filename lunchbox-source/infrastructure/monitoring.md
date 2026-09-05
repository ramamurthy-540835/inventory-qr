# Staging monitoring gates

Configure these checks before the staging test:

Staging deployment is manually triggered with `workflow_dispatch`. Repository administrators can add a protected GitHub `staging` environment later; the current collaborator account cannot create repository environments.

The Cloud Run service must accept unauthenticated network requests so Razorpay can reach the signed webhook. Application APIs remain protected by Firebase ID tokens, scoped staff claims, task secrets, or Razorpay HMAC signatures as appropriate.

- Cloud Run uptime check: `GET /api/health` every minute.
- Readiness check: `GET /api/health?ready=1`; alert after two consecutive failures.
- Error-log alert: JSON `severity=ERROR`, grouped by `event` and `errorName`.
- Payment alert: webhook 5xx responses or `REFUND_FAILED` orders.
- Capacity alert: `confirmed_meals + pending_meals > capacity_meals` must always be zero.
- Scheduler alert: no successful `expire-payments` invocation for five minutes.
- Budget notifications at 50%, 80%, and 100% of the staging monthly budget.

Do not include student names, phone numbers, allergies, Firebase tokens, Razorpay signatures, or secret values in logs. `correlationId`, order ID, kitchen ID, school ID, route ID, status, and aggregate counts are acceptable operational fields.
