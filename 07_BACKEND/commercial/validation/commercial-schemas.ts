import { z } from 'zod';

const optionalTrimmedString = z.string().max(4096).optional();
const nonEmptyString = (label: string, max = 4096) =>
  z.string().trim().min(1, `${label} is required`).max(max);

// ============================================================================
// 1. CLIENT ENTITLEMENT & DEVICE SCHEMAS
// ============================================================================

export const SwitchDeviceSchema = z.strictObject({
  token: optionalTrimmedString,
  hwid: optionalTrimmedString,
  legacyHwid: optionalTrimmedString,
  legacyDeviceId: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
  platform: optionalTrimmedString,
});

export const DemoRequestSchema = z.strictObject({
  fullName: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  companyName: optionalTrimmedString,
  teamSize: optionalTrimmedString,
  useCase: optionalTrimmedString,
  contactMethod: optionalTrimmedString,
  preferredDatetime: optionalTrimmedString,
  message: z.string().max(4000).optional(),
});

export const FunnelTrackSchema = z.strictObject({
  eventName: nonEmptyString('eventName', 120),
  userId: optionalTrimmedString,
  anonymousId: optionalTrimmedString,
  planId: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  sourceUrl: z.string().max(2048).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ActivateLicenseKeySchema = z.strictObject({
  licenseKey: nonEmptyString('licenseKey', 256),
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
});

export const RevokeDeviceSchema = z.strictObject({
  deviceId: nonEmptyString('deviceId', 256),
});

// ============================================================================
// 2. BILLING & PAYMENT SCHEMAS
// ============================================================================

export const UpiSubmitSchema = z.strictObject({
  utr: z.string().max(128).optional(),
  planId: optionalTrimmedString,
  plan_id: optionalTrimmedString,
  plan: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  billing_cycle: optionalTrimmedString,
  billing: optionalTrimmedString,
  proofAsset: z.string().max(4096).optional(),
  proof_asset: z.string().max(4096).optional(),
  receiptUrl: z.string().max(4096).optional(),
  receipt_url: z.string().max(4096).optional(),
  extraMembers: z.union([z.number(), z.string()]).optional(),
  extra_members: z.union([z.number(), z.string()]).optional(),
  extraProxyGb: z.union([z.number(), z.string()]).optional(),
  extra_proxy_gb: z.union([z.number(), z.string()]).optional(),
  idempotencyKey: optionalTrimmedString,
});

export const CryptoSubmitSchema = z.strictObject({
  txHash: z.string().max(128).optional(),
  tx_hash: z.string().max(128).optional(),
  hash: z.string().max(128).optional(),
  utr: z.string().max(128).optional(),
  network: optionalTrimmedString,
  planId: optionalTrimmedString,
  plan_id: optionalTrimmedString,
  plan: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  billing_cycle: optionalTrimmedString,
  billing: optionalTrimmedString,
  proofAsset: z.string().max(4096).optional(),
  proof_asset: z.string().max(4096).optional(),
  receiptUrl: z.string().max(4096).optional(),
  receipt_url: z.string().max(4096).optional(),
  extraMembers: z.union([z.number(), z.string()]).optional(),
  extra_members: z.union([z.number(), z.string()]).optional(),
  extraProxyGb: z.union([z.number(), z.string()]).optional(),
  extra_proxy_gb: z.union([z.number(), z.string()]).optional(),
  idempotencyKey: optionalTrimmedString,
});

export const BillingCheckoutSchema = z.strictObject({
  planId: optionalTrimmedString,
  plan: optionalTrimmedString,
  plan_id: optionalTrimmedString,
  requestedPlan: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  billing: optionalTrimmedString,
  billing_cycle: optionalTrimmedString,
  provider: optionalTrimmedString,
  currency: optionalTrimmedString,
  extraMembers: z.union([z.number(), z.string()]).optional(),
  extraProxyGb: z.union([z.number(), z.string()]).optional(),
  successUrl: z.string().max(2048).optional(),
  cancelUrl: z.string().max(2048).optional(),
  idempotencyKey: optionalTrimmedString,
});

export const VerifyRazorpaySchema = z.strictObject({
  razorpay_order_id: optionalTrimmedString,
  razorpay_payment_id: optionalTrimmedString,
  razorpay_signature: optionalTrimmedString,
});

export const VerifyYoupiSchema = z.strictObject({
  paymentId: optionalTrimmedString,
  orderId: optionalTrimmedString,
  external_payment_id: optionalTrimmedString,
  externalOrderId: optionalTrimmedString,
});

// ============================================================================
// 3. CENTRAL & DESKTOP AUTH SCHEMAS
// ============================================================================

export const LegacySignupSchema = z.strictObject({
  email: optionalTrimmedString,
  password: z.string().max(512).optional(),
  name: optionalTrimmedString,
  acceptedTerms: z.unknown().optional(),
  termsVersion: optionalTrimmedString,
});

export const LegacyLoginSchema = z.strictObject({
  email: optionalTrimmedString,
  password: z.string().max(512).optional(),
  hwid: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
});

export const AuthRegisterSchema = z.strictObject({
  email: optionalTrimmedString,
  password: z.string().max(512).optional(),
  confirmPassword: z.string().max(512).optional(),
  name: optionalTrimmedString,
  acceptedTerms: z.unknown().optional(),
  termsVersion: optionalTrimmedString,
  planId: optionalTrimmedString,
  plan: optionalTrimmedString,
  plan_id: optionalTrimmedString,
  requestedPlan: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  billing: optionalTrimmedString,
  intent: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
  platform: optionalTrimmedString,
  returnUrl: z.string().max(2048).optional(),
  redirectUri: z.string().max(2048).optional(),
});

export const VerifyEmailSchema = z.strictObject({
  token: optionalTrimmedString,
});

export const ResendVerificationSchema = z.strictObject({
  email: optionalTrimmedString,
});

export const AuthLoginSchema = z.strictObject({
  email: optionalTrimmedString,
  password: z.string().max(512).optional(),
  hwid: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
  platform: optionalTrimmedString,
  acceptedTerms: z.unknown().optional(),
  returnUrl: z.string().max(2048).optional(),
  redirectUri: z.string().max(2048).optional(),
  intent: optionalTrimmedString,
});

export const DesktopExchangeSchema = z.strictObject({
  ticket: optionalTrimmedString,
  code: optionalTrimmedString,
  code_verifier: optionalTrimmedString,
});

export const DesktopHandoffSchema = z.strictObject({
  ticket: optionalTrimmedString,
  code: optionalTrimmedString,
});

export const WebHandoffSchema = z.strictObject({
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
  platform: optionalTrimmedString,
  returnUrl: z.string().max(2048).optional(),
  redirectUri: z.string().max(2048).optional(),
  intent: optionalTrimmedString,
  planId: optionalTrimmedString,
  plan: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
});

export const WebHandoffExchangeSchema = z.strictObject({
  handoffCode: optionalTrimmedString,
  code: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
});

export const GoogleAuthPostSchema = z.strictObject({
  idToken: z.string().max(8192).optional(),
  id_token: z.string().max(8192).optional(),
  code: z.string().max(4096).optional(),
  redirectUri: z.string().max(2048).optional(),
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
  platform: optionalTrimmedString,
  acceptedTerms: z.unknown().optional(),
  termsVersion: optionalTrimmedString,
  intent: optionalTrimmedString,
  planId: optionalTrimmedString,
  billingCycle: optionalTrimmedString,
  returnUrl: z.string().max(2048).optional(),
});

export const RefreshTokenSchema = z.strictObject({
  refreshToken: z.string().max(4096).optional(),
  token: z.string().max(4096).optional(),
});

export const LogoutSchema = z.strictObject({
  sessionId: optionalTrimmedString,
  refreshToken: z.string().max(4096).optional(),
  token: z.string().max(4096).optional(),
});

export const ForgotPasswordSchema = z.strictObject({
  email: optionalTrimmedString,
});

export const ResetPasswordSchema = z.strictObject({
  token: optionalTrimmedString,
  newPassword: z.string().max(512).optional(),
  password: z.string().max(512).optional(),
});

export const RevokeSessionSchema = z.strictObject({
  sessionId: optionalTrimmedString,
});

export const RevokeAllSessionsSchema = z.strictObject({
  keepCurrent: z.boolean().optional(),
});

export const TrialActivateSchema = z.strictObject({
  planId: optionalTrimmedString,
  plan_id: optionalTrimmedString,
  plan: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
});

// ============================================================================
// 4. ADMIN & OWNER CONSOLE SCHEMAS
// ============================================================================

export const SupportChatSchema = z.strictObject({
  message: z.string().max(4000).optional(),
  userEmail: optionalTrimmedString,
  userName: optionalTrimmedString,
  source: optionalTrimmedString,
  accountOrPlan: optionalTrimmedString,
});

export const AdminDemoStatusSchema = z.strictObject({
  status: nonEmptyString('status', 64),
  adminNotes: z.string().max(4000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminSupportStatusSchema = z.strictObject({
  status: nonEmptyString('status', 64),
  adminNotes: z.string().max(4000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminSupportReplySchema = z.strictObject({
  reply: z.string().max(4000).optional(),
  status: optionalTrimmedString,
  adminNotes: z.string().max(4000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminUserStatusSchema = z.strictObject({
  status: nonEmptyString('status', 64),
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminUserPlanSchema = z.strictObject({
  planId: nonEmptyString('planId', 120),
  adminSecret: optionalTrimmedString,
});

export const AdminBoostQuotaSchema = z.strictObject({
  type: nonEmptyString('type', 64),
  amount: z.coerce.number().int().finite(),
  adminSecret: optionalTrimmedString,
});

export const AdminFeatureOverridesSchema = z.strictObject({
  overrides: z.record(z.string(), z.unknown()).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminResetDevicesSchema = z.strictObject({
  adminSecret: optionalTrimmedString,
});

export const AdminCreatePlanSchema = z.strictObject({
  name: nonEmptyString('name', 120),
  tier: nonEmptyString('tier', 64),
  priceMonthly: z.number().finite().nonnegative(),
  priceAnnual: z.number().finite().nonnegative(),
  limits: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminUpdatePlanSchema = z.strictObject({
  name: z.string().max(120).optional(),
  tier: z.string().max(64).optional(),
  priceMonthly: z.number().finite().nonnegative().optional(),
  priceAnnual: z.number().finite().nonnegative().optional(),
  limits: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminPricingDraftSchema = z.strictObject({
  prices: z.array(z.record(z.string(), z.unknown())).optional(),
  annualDiscountPercent: z.number().finite().min(0).max(100).optional(),
  existingSubscriberPolicy: optionalTrimmedString,
  adminSecret: optionalTrimmedString,
});

export const AdminPricingPublishSchema = z.strictObject({
  policy: optionalTrimmedString,
  existingSubscriberPolicy: optionalTrimmedString,
  adminSecret: optionalTrimmedString,
});

export const AdminActionSecretOnlySchema = z.strictObject({
  adminSecret: optionalTrimmedString,
});

export const AdminCreateLicenseSchema = z.strictObject({
  userId: optionalTrimmedString,
  planId: optionalTrimmedString,
  durationDays: z.number().finite().optional(),
  maxDevices: z.number().finite().optional(),
  notes: z.string().max(2000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminRevokeLicenseSchema = z.strictObject({
  licenseId: nonEmptyString('licenseId', 120),
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminExtendLicenseSchema = z.strictObject({
  licenseId: nonEmptyString('licenseId', 120),
  additionalDays: z.number().finite().optional(),
  newExpiresAt: optionalTrimmedString,
  adminSecret: optionalTrimmedString,
});

export const AdminPublishVersionSchema = z.strictObject({
  version: nonEmptyString('version', 64),
  releaseNotes: z.string().max(8000),
  minSupportedVersion: optionalTrimmedString,
  downloadUrlSetup: z.string().max(2048).optional(),
  downloadUrlPortable: z.string().max(2048).optional(),
  isMandatory: z.boolean().optional(),
  adminSecret: optionalTrimmedString,
});

export const AdminPaymentDecisionSchema = z.strictObject({
  reason: z.string().max(1000).optional(),
  adminNotes: z.string().max(2000).optional(),
  adminSecret: optionalTrimmedString,
});

export const OwnerVerifySchema = z.strictObject({
  code: z.union([z.string().max(32), z.number()]).optional(),
  adminSecret: optionalTrimmedString,
});

export const OwnerGrantSchema = z.strictObject({
  userId: optionalTrimmedString,
  planId: optionalTrimmedString,
  durationType: optionalTrimmedString,
  customExpiresAt: optionalTrimmedString,
  days: z.coerce.number().int().positive().max(3650).optional(),
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

export const OwnerPlanMutationSchema = z.strictObject({
  userId: optionalTrimmedString,
  planId: optionalTrimmedString,
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

export const OwnerUserMutationSchema = z.strictObject({
  userId: optionalTrimmedString,
  licenseId: optionalTrimmedString,
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

export const OwnerKillSwitchSchema = z.strictObject({
  enabled: z.boolean(),
  reason: z.string().max(1000).optional(),
  adminSecret: optionalTrimmedString,
});

// ============================================================================
// 5. CLOUD SYNC & TEAM WORKSPACE SCHEMAS
// ============================================================================

export const SyncUploadSessionSchema = z.strictObject({
  localProfileId: nonEmptyString('localProfileId', 256),
  profileName: nonEmptyString('profileName', 256),
  baseVersion: z.number().int().nonnegative(),
  mode: z.enum(['full', 'cookies_only']).optional(),
  archiveFormat: optionalTrimmedString,
  manifestHash: optionalTrimmedString,
  expectedSize: z.number().int().nonnegative(),
  expectedChecksum: nonEmptyString('expectedChecksum', 256),
  encryptedDataKey: nonEmptyString('encryptedDataKey', 8192),
  iv: nonEmptyString('iv', 256),
  authTag: nonEmptyString('authTag', 256),
  deviceId: nonEmptyString('deviceId', 256),
  deviceName: optionalTrimmedString,
});

export const SyncFinalizeUploadSchema = z.strictObject({
  sessionId: nonEmptyString('sessionId', 256),
  profileName: optionalTrimmedString,
  localProfileId: optionalTrimmedString,
  deviceId: optionalTrimmedString,
  deviceName: optionalTrimmedString,
});

export const SyncDownloadSessionSchema = z.strictObject({
  cloudProfileId: nonEmptyString('cloudProfileId', 256),
  version: z.number().int().positive().optional(),
  mode: optionalTrimmedString,
});

export const SyncLockAcquireSchema = z.strictObject({
  cloudProfileId: nonEmptyString('cloudProfileId', 256),
  deviceId: nonEmptyString('deviceId', 256),
  deviceName: optionalTrimmedString,
  ttlSeconds: z.number().int().positive().max(86400).optional(),
});

export const SyncLockRenewSchema = z.strictObject({
  cloudProfileId: nonEmptyString('cloudProfileId', 256),
  deviceId: nonEmptyString('deviceId', 256),
  ttlSeconds: z.number().int().positive().max(86400).optional(),
});

export const SyncLockReleaseSchema = z.strictObject({
  cloudProfileId: nonEmptyString('cloudProfileId', 256),
  deviceId: nonEmptyString('deviceId', 256),
});

export const CreateWorkspaceSchema = z.strictObject({
  name: z.string().max(256),
  description: z.string().max(2000).optional(),
  workspaceKeyEnvelope: z.string().max(8192).optional(),
});

export const AcceptWorkspaceInvitationSchema = z.strictObject({
  token: nonEmptyString('token', 512),
});

export const UpdateWorkspaceSchema = z.strictObject({
  name: z.string().max(256).optional(),
  description: z.string().max(2000).optional(),
});

export const TransferWorkspaceOwnershipSchema = z.strictObject({
  newOwnerUserId: nonEmptyString('newOwnerUserId', 256),
});

export const InviteWorkspaceMemberSchema = z.strictObject({
  email: nonEmptyString('email', 320),
  role: optionalTrimmedString,
});

export const UpdateWorkspaceMemberRoleSchema = z.strictObject({
  role: nonEmptyString('role', 64),
});

export const ShareProfileToWorkspaceSchema = z.strictObject({
  cloudProfileId: nonEmptyString('cloudProfileId', 256),
  permissionLevel: z.enum(['VIEW', 'RUN', 'EDIT', 'ADMIN']).optional(),
  encryptedKeyEnvelope: nonEmptyString('encryptedKeyEnvelope', 8192),
});

export const SetWorkspaceKeyEnvelopeSchema = z.strictObject({
  targetUserId: nonEmptyString('targetUserId', 256),
  encryptedKey: nonEmptyString('encryptedKey', 8192),
});
