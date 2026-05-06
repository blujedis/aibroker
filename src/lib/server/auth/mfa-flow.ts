export function isMfaEnrollmentComplete(options: {
  mfaEnabled: boolean;
  mfaSecret: string | null;
}): boolean {
  return options.mfaEnabled && Boolean(options.mfaSecret);
}

export function getPendingMfaDestination(options: {
  mfaEnabled: boolean;
  mfaSecret: string | null;
}): '/mfa/setup' | '/mfa/verify' {
  return isMfaEnrollmentComplete(options) ? '/mfa/verify' : '/mfa/setup';
}
