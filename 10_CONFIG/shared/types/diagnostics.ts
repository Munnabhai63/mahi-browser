export type DiagnosticStatus = 'PASS' | 'WARN' | 'FAIL';

export type StealthGrade = 'ULTRA' | 'MODERATE' | 'RISK';

export interface DiagnosticCheck {
  id: string;
  category: 'NETWORK' | 'CANVAS' | 'WEBGL' | 'AUDIO' | 'HARDWARE' | 'LOCALE';
  name: string;
  description: string;
  status: DiagnosticStatus;
  score: number; // 0 to 100
  actualValue: string;
  expectedValue: string;
  recommendation?: string;
}

export interface ProfileAuditReport {
  profileId: string;
  profileName: string;
  overallScore: number; // 0 to 100
  stealthGrade: StealthGrade;
  passedCount: number;
  warnCount: number;
  failCount: number;
  checks: DiagnosticCheck[];
  auditedAt: string;
}
