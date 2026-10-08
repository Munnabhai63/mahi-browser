import crypto from 'node:crypto';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  token?: string;
  actionUrl?: string;
  sentAt: string;
}

export interface EmailProvider {
  sendVerificationEmail(email: string, token: string, verifyUrl: string): Promise<boolean>;
  sendPasswordResetEmail(email: string, token: string, resetUrl: string): Promise<boolean>;
  sendSecurityAlert(email: string, alertType: string, details: string): Promise<boolean>;
  sendWorkspaceInvitationEmail(email: string, token: string, workspaceName: string, inviterName: string, inviteUrl: string): Promise<boolean>;
}

export class DevelopmentEmailProvider implements EmailProvider {
  private sentEmails: EmailMessage[] = [];

  async sendVerificationEmail(email: string, token: string, verifyUrl: string): Promise<boolean> {
    const msg: EmailMessage = {
      to: email,
      subject: 'Verify your MAHI Browser Account',
      html: `<p>Welcome to MAHI Browser! Click the link below to verify your email address:</p><a href="${verifyUrl}">Verify Email</a><p>Or use token: <code>${token}</code></p>`,
      token,
      actionUrl: verifyUrl,
      sentAt: new Date().toISOString(),
    };
    this.sentEmails.push(msg);
    console.log(`[EmailService:DEV] Verification email queued for ${email} (Token: ${token.substring(0, 8)}...)`);
    return true;
  }

  async sendPasswordResetEmail(email: string, token: string, resetUrl: string): Promise<boolean> {
    const msg: EmailMessage = {
      to: email,
      subject: 'Reset your MAHI Browser Password',
      html: `<p>A password reset was requested for your account. Click below to reset your password:</p><a href="${resetUrl}">Reset Password</a><p>Or use token: <code>${token}</code></p>`,
      token,
      actionUrl: resetUrl,
      sentAt: new Date().toISOString(),
    };
    this.sentEmails.push(msg);
    console.log(`[EmailService:DEV] Password reset email queued for ${email} (Token: ${token.substring(0, 8)}...)`);
    return true;
  }

  async sendSecurityAlert(email: string, alertType: string, details: string): Promise<boolean> {
    const msg: EmailMessage = {
      to: email,
      subject: `Security Alert: ${alertType}`,
      html: `<p>Security event detected: ${alertType}</p><p>${details}</p>`,
      sentAt: new Date().toISOString(),
    };
    this.sentEmails.push(msg);
    console.log(`[EmailService:DEV] Security alert sent to ${email}: ${alertType}`);
    return true;
  }

  async sendWorkspaceInvitationEmail(email: string, token: string, workspaceName: string, inviterName: string, inviteUrl: string): Promise<boolean> {
    const msg: EmailMessage = {
      to: email,
      subject: `You've been invited to join "${workspaceName}" on MAHI Browser`,
      html: `<p>Hello,</p><p><strong>${inviterName}</strong> has invited you to join team workspace <strong>"${workspaceName}"</strong> on MAHI Browser.</p><p><a href="${inviteUrl}">Accept Invitation</a></p><p>Or enter invitation token in your app: <code>${token}</code></p>`,
      token,
      actionUrl: inviteUrl,
      sentAt: new Date().toISOString(),
    };
    this.sentEmails.push(msg);
    console.log(`[EmailService:DEV] Workspace invitation email queued for ${email} (Workspace: ${workspaceName}, Token: ${token.substring(0, 8)}...)`);
    return true;
  }

  getSentEmails(): EmailMessage[] {
    return [...this.sentEmails];
  }

  getLastEmailFor(email: string): EmailMessage | undefined {
    return [...this.sentEmails].reverse().find(m => m.to.toLowerCase() === email.toLowerCase());
  }

  clear(): void {
    this.sentEmails = [];
  }

  static clear(): void {
    if (activeEmailProvider instanceof DevelopmentEmailProvider) {
      activeEmailProvider.clear();
    }
  }

  static getLastEmailFor(email: string): EmailMessage | undefined {
    if (activeEmailProvider instanceof DevelopmentEmailProvider) {
      return activeEmailProvider.getLastEmailFor(email);
    }
    return undefined;
  }

  static getSentEmails(): EmailMessage[] {
    if (activeEmailProvider instanceof DevelopmentEmailProvider) {
      return activeEmailProvider.getSentEmails();
    }
    return [];
  }
}

// Singleton provider instance
let activeEmailProvider: EmailProvider = new DevelopmentEmailProvider();

export function getEmailProvider(): EmailProvider {
  return activeEmailProvider;
}

export function setEmailProvider(provider: EmailProvider): void {
  activeEmailProvider = provider;
}
