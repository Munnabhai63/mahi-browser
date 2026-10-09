# MAHI Browser — Admin Pricing Control Operations Guide

**Document ID:** `docs/MAHI_BROWSER_ADMIN_PRICING_GUIDE.md`  
**Audience:** Platform Administrators, Operations & Commercial Managers  
**Version:** 1.0.0  
**Target URL:** `http://127.0.0.1:32123/admin` or Desktop Admin Dashboard  

---

## Quick Reference: How to Change Plan Pricing

### Example: Change Professional 10 from ₹299 to ₹599

No code editing or developer deployment required. Follow these steps:

1. **Open Admin Panel:**  
   Navigate to the Web Admin Suite at `http://127.0.0.1:32123/admin` (or click **Admin** in the desktop app sidebar) and select **Plans & Tiers** under Billing.

2. **Locate Target Plan:**  
   Find **Professional 10** (`pro_10`) in the Personal Plans section.

3. **Input New Monthly Price:**  
   Type `599` in the Monthly Price field.  
   *(Notice: The Annual Price automatically recalculates to ₹3,594/yr based on the 50% annual discount setting).*

4. **Click "Save Draft":**  
   Saves your draft pricing without affecting active users or public listings.

5. **Click "Preview Changes":**  
   Inspect the side-by-side diff showing:
   - Old Price: ₹299/mo (₹3,588/yr)
   - New Price: ₹599/mo (₹3,594/yr)
   - Price Shift: +100.3%
   - Impacted Active Subscribers count.

6. **Select Subscriber Policy:**  
   Choose how current subscribers should be handled:
   - **Grandfathering (Recommended):** Existing subscribers keep paying ₹299 on renewals. Only new signups pay ₹599.
   - **Migrate on Renewal:** Current subscribers pay ₹599 starting on their next renewal date.
   - **Migrate Immediately:** Prorates and updates all active subscriptions right away.

7. **Click "Publish Pricing":**  
   The platform atomically commits Version `v2`.

8. **Automatic Ecosystem Synchronization:**  
   The entire product suite instantly adopts the new price:
   - **Landing Page:** Pricing tables update dynamically.
   - **Desktop App:** Upgrade modal and in-app checkout reflect ₹599.
   - **Web SaaS & Mobile App:** Central catalog serves ₹599.
   - **Stripe & Razorpay:** Gateway plans and price IDs are synchronized.

---

## Emergency Rollback

If a price change needs to be reversed immediately:

1. Go to **Plans & Tiers** → **Version History**.
2. Locate the prior active version (e.g., `v1`).
3. Click **Rollback to v1**.
4. Enter an audit reason (e.g. *"Campaign ended"*).
5. All public checkout endpoints immediately revert to the previous pricing.

---

## Important Rules for Administrators

1. **Entitlements are Untouchable by Price Changes:**  
   Changing a price only changes billing amounts. It will **never** alter a customer's profile limits, proxy quotas, or cloud browser features.
2. **Annual Discount Setting:**  
   Changing the Annual Discount percentage (e.g. from 50% to 40%) applies across all plan annual calculations automatically.
3. **No Dev Dependency:**  
   Never modify frontend files (`main.js`, `AdminApp.tsx`) to adjust pricing. The Admin Control Suite is the single authoritative source of truth.
