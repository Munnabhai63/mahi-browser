# MAHI Browser — Sovereign YouPI Payment Gateway Runbook

This guide covers production configuration, credentials, local smoke testing, webhook verification, error handling, and secret rotation for the sovereign 0% fee YouPI payment gateway.

---

## 1. Required Owner Environment Configuration

To activate instant 0% fee UPI and dynamic QR checkouts in production, copy `.env.example` to `.env` (gitignored) and populate the YouPI block:

```bash
# ── OWNER GATEWAY: YouPI (0% fee UPI / Dynamic QR) ──
YOUPI_PG_BASE_URL=https://your-youpi-gateway-host
BASE_PAYMENT_API_URL=https://your-youpi-gateway-host
YOUPI_PG_MERCHANT_ID=your-merchant-uuid-or-id
YOUPI_PG_API_KEY=your-merchant-secret-key
YOUPI_PG_SECRET=your-merchant-secret-key
YOUPI_PG_WEBHOOK_SECRET=your-hmac-webhook-verification-secret
YOUPI_WEBHOOK_SECRET=your-hmac-webhook-verification-secret
YOUPI_PG_CHECKOUT_URL=https://checkout.your-youpi-gateway.com # Optional
```

*Note: Never commit `.env`. Keep production keys secure on your deployment host.*

---

## 2. Local Smoke Testing

Test gateway reachability and credentials directly from terminal without a browser:

```bash
# 1. Start backend gateway service
npm run start:gateway

# 2. Issue a smoke order creation request
curl -s -H "X-Merchant-Id: $YOUPI_PG_MERCHANT_ID" \
        -H "X-Merchant-Key: $YOUPI_PG_API_KEY" \
        -H "Content-Type: application/json" \
        -X POST "$YOUPI_PG_BASE_URL/api/v1/payments" \
        -d '{"orderId":"smoke_1","amount":"1.00","currency":"INR","returnUrl":"https://mahibrowser.com/pricing"}'
```

**Interpretation**: Any non-5xx JSON response containing an order or checkout session indicates valid authentication and operational credentials.

---

## 3. End-to-End Payment Verification Flow

1. **Initiate Checkout**:
   - Open `/pricing` on MAHI Browser or web portal.
   - Click **Pay Now (Instant UPI)** on the desired plan tier.
   - Verify redirection to the YouPI hosted checkout page with dynamic QR code.
2. **Complete UPI Transfer**:
   - Scan QR code via PhonePe, Google Pay, Paytm, CRED, or BHIM.
   - Complete payment of the authoritative minor-unit amount.
3. **Inbound Webhook Dispatch**:
   - The YouPI gateway dispatches an HTTP POST request to:
     `POST /api/v1/billing/webhook`
   - Header `X-Youpi-Signature` contains the HMAC-SHA256 digest calculated using `YOUPI_PG_WEBHOOK_SECRET`.
4. **Database & Entitlement Verification**:
   - Confirm a row exists in database table `commercial_payments`:
     ```sql
     SELECT id, user_id, provider, amount_cents, status, external_order_id FROM commercial_payments ORDER BY created_at DESC LIMIT 1;
     ```
   - Confirm `status` transitioned from `PENDING` to `PAID` or `COMPLETED`.
   - Confirm the user's plan is updated in `commercial_subscriptions` and `commercial_users`.

---

## 4. PaymentGatewayNotConfiguredError (Expected Behavior)

When running in `NODE_ENV=production` without `YOUPI_PG_BASE_URL` or `YOUPI_PG_API_KEY`, calls to initiate YouPI checkouts throw:

```
PaymentGatewayNotConfiguredError: youpi_pg: YouPI-PG credentials are not configured.
```

**This is intentional security behavior, not a bug.** It strictly prevents unauthenticated or forged transactions, protecting the system from generating free licenses or leaking mock tokens in production.

---

## 5. Safe Secret & Key Rotation Runbook

To rotate `YOUPI_PG_API_KEY` or `YOUPI_PG_WEBHOOK_SECRET` with zero downtime:

1. **Generate New Credentials**:
   - In your YouPI Gateway admin portal, generate a secondary API key and new webhook secret.
2. **Update Environment**:
   - Update `.env` with the new values on the production VPS.
3. **Graceful Reload**:
   - Reload the backend daemon:
     ```bash
     pm2 reload mahi-backend --update-env
     # or: systemctl restart mahi-backend
     ```
4. **Deprecate Old Key**:
   - In YouPI Gateway admin, revoke the old API key once active traffic confirms smooth operation.

---

## 6. Payment Email Notifications

MAHI Browser provides transactional email notifications across the payment and manual UPI lifecycle:
1. **Admin UTR Submission Alert** (`sendBillingAlert`): Dispatched to the admin (`ADMIN_PAYMENT_EMAIL`, falling back to `SUPPORT_EMAIL`) when a user submits a manual UPI UTR, detailing the payment ID, amount in INR, UTR, user ID, timestamp, and action instructions.
2. **Payment Pending Confirmation** (`sendPaymentPendingEmail`): Available for user-facing pending status notifications containing plan name, amount, UTR, and submission timestamp.
3. **Payment Approved Notification** (`sendPaymentApprovedEmail`): Sent directly to the customer's verified email upon admin approval, confirming plan activation, amount paid, timestamp, and access instructions.
4. **Payment Rejected Notification** (`sendPaymentRejectedEmail`): Sent to the customer if an invalid or unverified UTR submission is rejected, containing the explicit rejection reason and support contact info.

### Fault Tolerance & Non-Blocking Design
All email dispatches are isolated in best-effort blocks. If the email provider fails or SMTP is offline, the error is safely logged (`[PaymentService] ... failed`) and payment processing/activation proceeds without interruption.

### Required Environment Configuration
To enable live email delivery in production:
- **REST API Delivery (Resend / SendGrid)**:
  ```bash
  EMAIL_API_KEY=your-api-key # or RESEND_API_KEY
  EMAIL_FROM=support@mahibrowser.com
  ```
- **SMTP Delivery**:
  ```bash
  SMTP_HOST=smtp.mailgun.org
  SMTP_PORT=587
  SMTP_USER=postmaster@mahibrowser.com
  SMTP_PASS=your-smtp-password
  SMTP_FROM=MAHI Browser <noreply@mahibrowser.com>
  ```
- **Admin Alert Recipient**:
  ```bash
  ADMIN_PAYMENT_EMAIL=admin@mahibrowser.com # Optional; defaults to SUPPORT_EMAIL
  ```

### How to Verify
Submit a test UTR via `/pricing` or API in development mode and check stdout logs:
- `[EmailService:DEV] Billing alert sent to ...`
- `[EmailService:DEV] payment.approved -> <masked> plan=... amount=...`

---

## 7. Support Mailbox Migration

The active support and billing mailbox is currently hosted on Gmail (`mahiverse.official@gmail.com` and `mahiverse.hub@gmail.com`). This is an operational reality and not a defect.

When custom branded domain mailboxes (e.g. `support@mahibrowser.com`, `billing@mahibrowser.com`, `contact@mahibrowser.com`) are provisioned in the future:
1. Update `SUPPORT_EMAIL`, `BUSINESS_EMAIL`, and `BILLING_EMAIL` constants in `10_CONFIG/contact-config.ts`.
2. Update `BRAND.officialEmail` and `BRAND.hubEmail` in `landing/lib/brand.ts`.
3. If using SMTP or API email delivery for notifications, update `SMTP_USER` / `SMTP_FROM` / `EMAIL_FROM` in `.env`.
4. Run full typechecks and builds (`npm run build:prod` and `npm --prefix landing run build`), then redeploy both the landing site and backend gateway daemon.

