export type CaptchaProvider = '2captcha' | 'capmonster' | 'anticaptcha' | 'ezcaptcha';

export type CaptchaType = 'turnstile' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'funcaptcha';

export interface CaptchaConfig {
  enabled: boolean;
  provider: CaptchaProvider;
  apiKey: string;
  autoSolveInBrowser: boolean;
  autoSolveInRpa: boolean;
  timeoutSeconds: number;
}

export interface CaptchaBalanceResult {
  provider: CaptchaProvider;
  balance: number;
  currency: string;
  success: boolean;
  error?: string;
}

export interface CaptchaSolveRequest {
  provider?: CaptchaProvider;
  apiKey?: string;
  type: CaptchaType;
  websiteUrl: string;
  websiteKey: string;
  action?: string;
  enterprise?: boolean;
}

export interface CaptchaSolveResult {
  success: boolean;
  token?: string;
  solveTimeSeconds?: number;
  error?: string;
}
