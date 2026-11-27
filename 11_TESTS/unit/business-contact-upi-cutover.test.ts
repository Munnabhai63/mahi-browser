import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import {
  BUSINESS_EMAIL,
  SUPPORT_EMAIL,
  BILLING_EMAIL,
  SUPPORT_ESCALATION_EMAIL,
  WHATSAPP_NUMBER,
  WHATSAPP_RAW_NUMBER,
  X_URL,
  LINKEDIN_URL,
  FACEBOOK_URL,
  TELEGRAM_URL,
  INSTAGRAM_URL,
  YOUTUBE_URL,
  UPI_ID,
  UPI_ACCOUNT_HOLDER,
  UPI_QR_ASSET,
  USDT_ENABLED,
  USDT_ADDRESS,
  USDT_NETWORK,
  USDT_QR_ASSET,
  isValidEmail,
  isValidWhatsAppNumber,
  isValidUpiId,
  isValidSocialUrl,
  buildWhatsAppLink,
  getAuthoritativeContactConfig,
} from '../../10_CONFIG/contact-config.js';
import {
  DevelopmentEmailProvider,
  getEmailProvider,
  setEmailProvider,
} from '../../05_AUTH/email-service.js';
import {
  classifySupportQuery,
  handleSupportChatMessage,
} from '../../07_BACKEND/commercial/support-ticket-service.js';

describe('Production Business Contact & UPI Cutover Verification', () => {
  let devEmailProvider: DevelopmentEmailProvider;

  beforeAll(async () => {
    await initializeDatabase();
  });

  beforeEach(() => {
    devEmailProvider = new DevelopmentEmailProvider();
    setEmailProvider(devEmailProvider);
    devEmailProvider.clear();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. CANONICAL CONTACT CONFIGURATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('Canonical Contact Configuration Values', () => {
    it('enforces exact authoritative business and support emails', () => {
      expect(BUSINESS_EMAIL).toBe('mahiverse.hub@gmail.com');
      expect(SUPPORT_EMAIL).toBe('mahiverse.official@gmail.com');
      expect(BILLING_EMAIL).toBe('mahiverse.official@gmail.com');
      expect(SUPPORT_ESCALATION_EMAIL).toBe('mahiverse.official@gmail.com');
    });

    it('enforces exact authoritative WhatsApp configuration', () => {
      expect(WHATSAPP_NUMBER).toBe('+919376343629');
      expect(WHATSAPP_RAW_NUMBER).toBe('919376343629');
    });

    it('enforces exact authoritative social URLs and hides unconfigured ones', () => {
      expect(X_URL).toBe('https://x.com/MunaBhai63');
      expect(LINKEDIN_URL).toBe('https://www.linkedin.com/in/mahipal-choudhary-153ba83b1');
      expect(FACEBOOK_URL).toBe('');
      expect(TELEGRAM_URL).toBe('');
      expect(INSTAGRAM_URL).toBe('');
      expect(YOUTUBE_URL).toBe('');
    });

    it('enforces exact authoritative UPI and USDT (TRC-20) configuration', () => {
      expect(UPI_ID).toBe('6375823589@slc');
      expect(UPI_ACCOUNT_HOLDER).toBe('Mr Mahipal Choudhary');
      expect(UPI_QR_ASSET).toBe('/brand/mahi-upi-qr.png');
      expect(USDT_ENABLED).toBe(true);
      expect(USDT_ADDRESS).toBe('TPerRUMbJtNSmcRoBcQt1PpNpYCrEd5ziA');
      expect(USDT_NETWORK).toBe('TRC-20 (TRON)');
      expect(USDT_QR_ASSET).toBe('/brand/mahi-usdt-trc20-qr.png');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. WHATSAPP LINK & VALIDATION
  // ───────────────────────────────────────────────────────────────────────────
  describe('WhatsApp URL Generation & Validation', () => {
    it('generates canonical wa.me URL with clean digits and no spaces', () => {
      const link = buildWhatsAppLink('Hello MAHI');
      expect(link).toContain('https://wa.me/919376343629');
      expect(link).not.toContain(' ');
      expect(link).not.toContain('+');
      expect(link).toContain('text=Hello%20MAHI');
    });

    it('validates correct international phone numbers and rejects placeholders', () => {
      expect(isValidWhatsAppNumber('+919376343629')).toBe(true);
      expect(isValidWhatsAppNumber('919376343629')).toBe(true);
      expect(isValidWhatsAppNumber('+91 9376343629')).toBe(true);

      // Rejects dummy placeholders
      expect(isValidWhatsAppNumber('+919999999999')).toBe(false);
      expect(isValidWhatsAppNumber('+91 9876543210')).toBe(false);
      expect(isValidWhatsAppNumber('')).toBe(false);
      expect(isValidWhatsAppNumber('12345')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. UPI ID VALIDATION & QR ASSET EXISTENCE
  // ───────────────────────────────────────────────────────────────────────────
  describe('UPI Validation & Asset Verification', () => {
    it('validates canonical UPI ID format and rejects placeholders', () => {
      expect(isValidUpiId('6375823589@slc')).toBe(true);
      expect(isValidUpiId('mahi@okhdfcbank')).toBe(true);

      // Rejects dummy placeholders
      expect(isValidUpiId('mahibrowser@upi')).toBe(false);
      expect(isValidUpiId('test@example')).toBe(false);
      expect(isValidUpiId('')).toBe(false);
    });

    it('verifies the authoritative Slice QR asset exists in public and landing folders', () => {
      const landingQrPath = fs.existsSync(path.resolve(process.cwd(), 'landing/public/assets/img/payments/mahi-upi-qr.png'))
        ? path.resolve(process.cwd(), 'landing/public/assets/img/payments/mahi-upi-qr.png')
        : path.resolve(process.cwd(), 'landing/assets/img/payments/mahi-upi-qr.png');
      const publicQrPath = path.resolve(process.cwd(), 'public/brand/mahi-upi-qr.png');
      const brandAssetPath = path.resolve(process.cwd(), '13_ASSETS/brand/approved/mahi-upi-qr.png');

      expect(fs.existsSync(landingQrPath)).toBe(true);
      expect(fs.existsSync(publicQrPath)).toBe(true);
      expect(fs.existsSync(brandAssetPath)).toBe(true);

      const landingStat = fs.statSync(landingQrPath);
      expect(landingStat.size).toBeGreaterThan(1000); // Non-empty image file

      const landingUsdtQr = path.resolve(process.cwd(), 'landing/public/assets/img/payments/mahi-usdt-trc20-qr.png');
      const publicUsdtQr = path.resolve(process.cwd(), 'public/brand/mahi-usdt-trc20-qr.png');
      expect(fs.existsSync(landingUsdtQr)).toBe(true);
      expect(fs.existsSync(publicUsdtQr)).toBe(true);
      expect(fs.statSync(landingUsdtQr).size).toBeGreaterThan(1000);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. SOCIAL PROFILES & FILTERING
  // ───────────────────────────────────────────────────────────────────────────
  describe('Social URLs & Ghost Channel Elimination', () => {
    it('validates specific profile handles and rejects bare domain homepages', () => {
      expect(isValidSocialUrl('https://x.com/MunaBhai63')).toBe(true);
      expect(isValidSocialUrl('https://www.linkedin.com/in/mahipal-choudhary-153ba83b1')).toBe(true);

      // Banned root homepages with no profile
      expect(isValidSocialUrl('https://x.com')).toBe(false);
      expect(isValidSocialUrl('https://x.com/')).toBe(false);
      expect(isValidSocialUrl('https://linkedin.com')).toBe(false);
      expect(isValidSocialUrl('https://facebook.com')).toBe(false);
      expect(isValidSocialUrl('')).toBe(false);
    });

    it('hides unconfigured social links in getAuthoritativeContactConfig', () => {
      const config = getAuthoritativeContactConfig();
      expect(config.xUrl).toBe('https://x.com/MunaBhai63');
      expect(config.linkedinUrl).toBe('https://www.linkedin.com/in/mahipal-choudhary-153ba83b1');
      expect(config.facebookUrl).toBeUndefined();
      expect(config.telegramUrl).toBeUndefined();
      expect(config.instagramUrl).toBeUndefined();
      expect(config.youtubeUrl).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PAYMENT QUERY ESCALATION & EMAIL DELIVERY TARGET
  // ───────────────────────────────────────────────────────────────────────────
  describe('Payment Escalation Support System', () => {
    it('classifies payment query as PAYMENT and marks for strict escalation', () => {
      const res = classifySupportQuery('I paid via UPI ref 427189028341 but plan is not active');
      expect(res.isPaymentRelated).toBe(true);
      expect(res.category).toBe('PAYMENT');
      expect(res.suggestedReply).toContain('forwarded to our support team');
    });

    it('dispatches payment escalation email directly to mahiverse.official@gmail.com', async () => {
      const response = await handleSupportChatMessage({
        message: 'UPI transaction deducted money but subscription is still free. UTR: 637582358912',
        userEmail: 'customer@gmail.com',
        userName: 'Customer Test',
        accountOrPlan: 'pro',
      });

      expect(response.success).toBe(true);
      expect(response.isPaymentEscalated).toBe(true);
      expect(response.ticketNumber).toBeDefined();

      const sentEmails = devEmailProvider.getSentEmails();
      expect(sentEmails.length).toBeGreaterThanOrEqual(1);

      const escalationEmail = sentEmails.find(
        (m) => m.subject.includes('[MAHI Support] Payment Query Escalation')
      );
      expect(escalationEmail).toBeDefined();
      expect(escalationEmail!.to).toBe('mahiverse.official@gmail.com');
      expect(escalationEmail!.html).toContain('customer@gmail.com');
      expect(escalationEmail!.html).toContain('637582358912');
    });
  });
});
