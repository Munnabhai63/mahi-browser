import { describe, it, expect } from 'vitest';
import { isPaidPlan, isBusinessPlan } from '../../08_SECURITY/account-service.js';
import { DEFAULT_COMMERCIAL_PLANS } from '../../07_BACKEND/commercial/commercial-plan-service.js';

describe('Plan entitlement coverage', () => {
  it('saare paid plans isPaidPlan pass karein', () => {
    DEFAULT_COMMERCIAL_PLANS
      .filter((p) => p.priceMonthly > 0 || p.priceAnnual > 0)
      .forEach((p) => expect(isPaidPlan(p.id), `id=${p.id}`).toBe(true));
  });
  it('frontend ids paid hain', () => {
    ['starter', 'growth', 'ultimate'].forEach((id) =>
      expect(isPaidPlan(id), id).toBe(true)
    );
  });
  it('ultimate BUSINESS tier hai', () => {
    expect(isBusinessPlan('ultimate')).toBe(true);
    expect(isBusinessPlan('mahi_ultimate')).toBe(true);
  });
});
