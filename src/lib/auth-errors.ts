import { AuthError } from '@supabase/supabase-js';

import { TranslationKey } from '@/lib/i18n';

// Supabase answers in English ("Invalid login credentials", "User already
// registered"), and those strings used to be shown to the user as-is. Every
// auth failure is translated here instead, keyed on error.code, which is
// stable across GoTrue versions in a way the message text is not.

/** Kept in sync with the "Minimum password length" setting in Supabase Auth. */
export const MIN_PASSWORD_LENGTH = 8;

const CODE_TO_KEY: Record<string, TranslationKey> = {
  invalid_credentials: 'authInvalidCredentials',
  email_not_confirmed: 'authEmailNotConfirmed',
  user_already_exists: 'authUserAlreadyExists',
  email_exists: 'authUserAlreadyExists',
  user_banned: 'authUserBanned',
  weak_password: 'authWeakPassword',
  email_address_invalid: 'authEmailInvalid',
  validation_failed: 'authEmailInvalid',
  over_email_send_rate_limit: 'authEmailRateLimit',
  over_request_rate_limit: 'authRequestRateLimit',
  over_send_rate_limit: 'authRequestRateLimit',
  same_password: 'authSamePassword',
  otp_expired: 'authLinkExpired',
  flow_state_expired: 'authLinkExpired',
  flow_state_not_found: 'authLinkExpired',
  bad_code_verifier: 'authLinkExpired',
  signup_disabled: 'authSignupDisabled',
  email_provider_disabled: 'authSignupDisabled',
  session_expired: 'authSessionExpired',
  session_not_found: 'authSessionExpired',
  refresh_token_not_found: 'authSessionExpired',
  refresh_token_already_used: 'authSessionExpired',
};

/**
 * Older GoTrue responses (and a few current ones, like the mailer's own rate
 * limit) arrive without a code, so a handful of exact phrases are matched too.
 */
const MESSAGE_PATTERNS: [RegExp, TranslationKey][] = [
  [/invalid login credentials/i, 'authInvalidCredentials'],
  [/email not confirmed/i, 'authEmailNotConfirmed'],
  [/user already registered|already been registered/i, 'authUserAlreadyExists'],
  [/password should be at least/i, 'authWeakPassword'],
  [/unable to validate email address|invalid format/i, 'authEmailInvalid'],
  [/email rate limit exceeded|error sending (confirmation|recovery|magic link)/i, 'authEmailRateLimit'],
  [/for security purposes|request this after|too many requests/i, 'authRequestRateLimit'],
  [/different from the old password/i, 'authSamePassword'],
  [/expired|invalid flow state/i, 'authLinkExpired'],
  [/signups not allowed|signup is disabled/i, 'authSignupDisabled'],
  [/network request failed|failed to fetch|load failed/i, 'authNetworkError'],
];

function isNetworkFailure(error: unknown) {
  // AuthRetryableFetchError arrives with status 0 and no code at all.
  if (error instanceof AuthError && (error.status === 0 || error.status === undefined)) {
    return error.name === 'AuthRetryableFetchError';
  }

  return error instanceof TypeError;
}

export function authErrorKey(error: unknown): TranslationKey {
  if (isNetworkFailure(error)) return 'authNetworkError';

  if (error instanceof AuthError && error.code && CODE_TO_KEY[error.code]) {
    return CODE_TO_KEY[error.code];
  }

  const message = error instanceof Error ? error.message : '';
  const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));

  return match ? match[1] : 'authGenericError';
}

/** The only way an auth failure should ever reach the screen. */
export function describeAuthError(error: unknown, t: (key: TranslationKey) => string): string {
  return t(authErrorKey(error));
}
