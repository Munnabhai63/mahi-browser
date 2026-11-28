/**
 * MAHI Browser — Email Provider Smoke Test & Verification Tool
 *
 * Checks production email delivery readiness (SMTP / API) and allows
 * sending a test transaction email without customer disruption.
 */

import {
  createProductionEmailProvider,
  ProductionApiEmailProvider,
  ProductionSmtpEmailProvider,
  type EmailProvider,
} from '../05_AUTH/email-service.js';

async function main() {
  const args = process.argv.slice(2);
  let targetAddress: string | null = null;
  const sendIndex = args.indexOf('--send');
  if (sendIndex !== -1 && args[sendIndex + 1]) {
    targetAddress = args[sendIndex + 1].trim();
  }

  // Force production check to verify real credentials rather than dev mock
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  let provider: EmailProvider | null = null;
  try {
    provider = createProductionEmailProvider();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('PRODUCTION_EMAIL_UNCONFIGURED')) {
      console.log('EMAIL: NOT CONFIGURED — transactional email is disabled. Payments still work.');
      console.log('To enable email delivery in production, set either:');
      console.log('  - RESEND_API_KEY (or EMAIL_API_KEY) and EMAIL_FROM in .env');
      console.log('  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env');
      process.exit(0);
    }
    console.error(`[EmailVerification:ERROR] Unexpected error initializing email provider: ${msg}`);
    process.exit(1);
  }

  if (provider instanceof ProductionApiEmailProvider) {
    console.log('EMAIL: CONFIGURED — Transport: REST API (Resend / API Gateway)');
    console.log(`Sender: ${process.env.EMAIL_FROM || 'MAHI Browser <noreply@mahibrowser.com>'}`);
  } else if (provider instanceof ProductionSmtpEmailProvider) {
    console.log('EMAIL: CONFIGURED — Transport: SMTP Relay');
    console.log(`Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || '587'}`);
    console.log(`Sender: ${process.env.SMTP_FROM || 'MAHI Browser <noreply@mahibrowser.com>'}`);
  } else {
    console.log('EMAIL: NOT CONFIGURED — transactional email is disabled. Payments still work.');
    process.exit(0);
  }

  if (targetAddress) {
    console.log(`\nSending test payment approved email to: ${targetAddress}...`);
    try {
      const ok = await provider.sendPaymentApprovedEmail({
        email: targetAddress,
        planName: 'MAHI Pro (Verification Test)',
        amountInr: '599',
        paidAt: new Date().toISOString(),
      });
      if (ok) {
        console.log(`[✓] Test email successfully dispatched to ${targetAddress}.`);
      } else {
        console.log(`[-] Test email delivery failed to dispatch.`);
      }
    } catch (sendErr: unknown) {
      console.error(`[-] Failed sending test email: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`);
    }
  } else {
    console.log('\nTip: To dispatch a live test email to an inbox, run:');
    console.log('  npm run verify:email -- --send your-email@example.com');
  }
}

main().catch((err) => {
  console.error('Fatal error in email verification script:', err);
  process.exit(1);
});
