interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
}

function getMailgunConfig(): MailgunConfig {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const fromEmail = process.env.MAILGUN_FROM_EMAIL?.trim();

  if (!apiKey || !domain || !fromEmail) {
    throw new Error('Mailgun is not configured');
  }

  return { apiKey, domain, fromEmail };
}

export function buildInvitationUrl(token: string, origin?: string): string {
  const baseUrl = process.env.MAILGUN_BASE_URL?.trim() || origin?.trim();
  return new URL(`/invite/${token}`, baseUrl).toString();
}

export function buildPasswordResetUrl(token: string, origin?: string): string {
  const baseUrl = process.env.MAILGUN_BASE_URL?.trim() || origin?.trim();
  return new URL(`/reset-password/${token}`, baseUrl).toString();
}

export function buildMfaBreakGlassUrl(token: string, origin?: string): string {
  const baseUrl = process.env.MAILGUN_BASE_URL?.trim() || origin?.trim();
  return new URL(`/mfa/break-glass/${token}`, baseUrl).toString();
}

export async function sendPasswordResetEmail(input: {
  to: string;
  resetUrl: string;
  expiresInHours: number;
}): Promise<void> {
  const config = getMailgunConfig();
  const form = new FormData();

  form.set('from', config.fromEmail);
  form.set('to', input.to);
  form.set('subject', 'Reset your AiBroker password');
  form.set(
    'text',
    `You requested a password reset for your AiBroker account.\n\nReset link: ${input.resetUrl}\nThis link expires in ${input.expiresInHours} hour${input.expiresInHours === 1 ? '' : 's'}.\n\nIf you did not request a password reset, you can safely ignore this email.`
  );

  const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`
    },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mailgun send failed: ${detail || response.statusText}`);
  }
}

export async function sendInvitationEmail(input: {
  to: string;
  inviteUrl: string;
  role: string;
  profileName: string;
  expiresInHours: number;
  inviterName?: string;
  customMessage?: string | null;
}): Promise<void> {
  const config = getMailgunConfig();
  const form = new FormData();

  form.set('from', config.fromEmail);
  form.set('to', input.to);
  form.set('subject', 'You have been invited to AiBroker');

  const inviterLine = input.inviterName ? `${input.inviterName} invited you to AiBroker.` : 'You have been invited to AiBroker.';
  const messageLine = input.customMessage?.trim()
    ? `\n\nMessage from your administrator:\n${input.customMessage.trim()}`
    : '';

  form.set(
    'text',
    `${inviterLine}\n\nRole: ${input.role}\nProfile: ${input.profileName}\nInvitation link: ${input.inviteUrl}\nThis link expires in ${input.expiresInHours} hours.${messageLine}`
  );

  const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`
    },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mailgun send failed: ${detail || response.statusText}`);
  }
}

export async function sendMfaBreakGlassEmail(input: {
  to: string;
  breakGlassUrl: string;
  expiresInMinutes: number;
}): Promise<void> {
  const config = getMailgunConfig();
  const form = new FormData();

  form.set('from', config.fromEmail);
  form.set('to', input.to);
  form.set('subject', 'AiBroker emergency MFA recovery link');
  form.set(
    'text',
    `An emergency MFA recovery link was requested for your AiBroker account.\n\nRecovery link: ${input.breakGlassUrl}\nThis link expires in ${input.expiresInMinutes} minute${input.expiresInMinutes === 1 ? '' : 's'}.\n\nIf you did not request this, ignore this email.`
  );

  const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`
    },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mailgun send failed: ${detail || response.statusText}`);
  }
}
