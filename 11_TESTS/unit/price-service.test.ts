import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDynamicPrice,
  setDynamicPriceForTesting,
  fetchDynamicPrice
} from '../../08_SECURITY/price-service.js';

describe('Dynamic Price Service Unit Tests', () => {
  beforeEach(() => {
    setDynamicPriceForTesting(599);
  });

  it('should return default price of 599 initially', () => {
    expect(getDynamicPrice()).toBe(599);
  });

  it('should allow setting price for testing', () => {
    setDynamicPriceForTesting(499);
    expect(getDynamicPrice()).toBe(499);
    setDynamicPriceForTesting(599);
    expect(getDynamicPrice()).toBe(599);
  });

  it('should fetch and parse dynamic price from remote endpoint or fallback gracefully', async () => {
    const price = await fetchDynamicPrice();
    expect(typeof price).toBe('number');
    expect(price).toBeGreaterThan(0);
  });
});
