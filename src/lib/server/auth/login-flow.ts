export function getPostLoginDestination(options: {
  globalMfaEnabled: boolean;
  userMfaEnabled: boolean;
}): '/dashboard' | '/mfa/setup' | '/mfa/verify' {
  if (!options.globalMfaEnabled && !options.userMfaEnabled) return '/dashboard';
  return options.userMfaEnabled ? '/mfa/verify' : '/mfa/setup';
}

export function shouldMarkSessionMfaComplete(options: {
  globalMfaEnabled: boolean;
  userMfaEnabled: boolean;
}): boolean {
  return !options.globalMfaEnabled && !options.userMfaEnabled;
}
