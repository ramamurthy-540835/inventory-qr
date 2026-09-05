# Franchise operations integration

## Pricing and catalogue

- `lib/pricing.ts` is the server authority for the ₹49 market price, ₹39 sponsored price, grade multipliers, free-meal limits, and operating-cost defaults.
- Add `price_tier` (`market` or `sponsored`) to every Firestore `schools/{schoolId}` document. Missing or invalid values intentionally resolve to `market`.
- Catalogue reads are Firestore-first. `lib/meals.ts` is used only when GCP/Firestore is not configured or a development collection is empty.
- The order API calculates every paid line from the selected school tier. Client totals and stored meal catalogue prices are never trusted for checkout.

## Firestore setup

1. Create or update `kitchens/{kitchenId}` with:
   - `direct_cost_per_meal` (default `27`)
   - `monthly_fixed_cost` (default `124000`)
2. Seed active `cities`, `schools`, `meal_packages`, and `grade_nutrition_plans` collections. Grade multipliers remain code-controlled even when nutrition targets come from Firestore.
3. The order transaction creates `free_meal_cap_usage/{kitchenId}_{serviceDate}` automatically. Do not edit its `reserved_meals` value manually while orders are open.
4. Appointment records are created under:
   - `kitchens/{kitchenId}/staff_appointments/{appointmentId}`
   - `kitchens/{kitchenId}/school_meetings/{meetingId}`
5. Browser access remains denied by `infrastructure/firestore.rules`; all operations use authenticated server routes.

## BigQuery setup

1. Replace `YOUR_PROJECT_ID` in `infrastructure/bigquery.sql` and run it in `asia-south1` before deploying the new application revision.
2. The migration adds `price_tier`, `free_meals`, `free_meal_count`, and `free_meal_daily_cap` to `orders_v2`.
3. It creates or replaces `free_meal_summary` and adds `daily_free_meal_cap_usage`.
4. Deploy the schema before accepting free-meal orders, otherwise the analytics insert will reject the new fields.

## Access and routes

- Grant operators the Firebase custom claim `admin: true`.
- `/ops` is the admin-only kitchen dashboard and printable production sheet.
- `/ops/appointments` manages staff appointments, medical-certificate warnings, and school meetings.
- Existing kitchen/coordinator/driver tools remain at `/operations`.

## Environment variables

No new environment variables are required. Existing `GCP_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `BIGQUERY_DATASET`, `BIGQUERY_ORDERS_TABLE`, `GCS_BUCKET`, and Firebase settings are reused. Cost defaults are stored per kitchen and editable through `/admin`.

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. Test the daily free-meal boundary at 25 with a non-production Firestore project before enabling parent traffic.
