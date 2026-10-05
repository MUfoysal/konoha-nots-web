const AUTH_MESSAGES = {
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/invalid-credential': 'Email or password is incorrect. Please check your credentials and try again.',
  'auth/user-not-found': 'Email or password is incorrect. Please check your credentials and try again.',
  'auth/wrong-password': 'Email or password is incorrect. Please check your credentials and try again.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Please choose a stronger password.',
  'auth/requires-recent-login': 'For security, sign in again before making this change.',
  'auth/credential-already-in-use': 'That sign-in credential is already linked to another account.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled for the Firebase project.',
  'auth/unauthorized-domain': 'This website domain is not authorized for Firebase sign-in.',
  'auth/invalid-api-key': 'Firebase configuration is invalid. Contact the site administrator.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Unable to connect. Please check your internet connection and try again.',
  'auth/user-token-expired': 'Your sign-in session expired. Sign in again and try once more.',
  'auth/invalid-user-token': 'Your sign-in session is no longer valid. Sign in again and try once more.',
  'auth/email-already-verified': 'Your email is already verified. Choose “I’ve verified my email” to continue.',
  'auth/expired-action-code': 'That verification link has expired. Request a new verification email and try again.',
  'auth/invalid-action-code': 'That verification link is invalid or has already been used. Request a new verification email if needed.',
  'auth/user-disabled': 'This account is disabled. Contact support for help.',
  'konoha/email-not-verified': 'Please verify your email before signing in.',
  'konoha/no-current-user': 'Your sign-in session expired. Sign in again to continue.',
  'konoha/current-password-incorrect': 'Your current password is incorrect.',
  'konoha/password-provider-required': 'Password changes are available for email and password accounts.',
  'konoha/unsupported-provider': 'This security action is not available for the sign-in provider on this account.',
  'konoha/profile-not-found': 'Your profile could not be found. Sign out and sign in again.',
  'konoha/email-already-verified': 'Your email is already verified. Choose “I’ve verified my email” to continue.',
  'konoha/username-taken': 'That username is already in use.',
  'konoha/username-reservation-denied': 'Could not reserve this username. It may already be taken, or Firestore Security Rules may be blocking registration.',
  'konoha/verification-send-failed': 'Your account was created, but the verification email could not be sent. Use “Resend verification email” to try again.',
};

export function userMessage(error) {
  const code = error?.code;
  if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (code?.startsWith('konoha/') || error?.name === 'KonohaInputError') return error.message;
  if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'You do not have permission to access this scroll.';
  if (code === 'unavailable' || code === 'firestore/unavailable') return 'Konoha Archives are temporarily unavailable. Try again shortly.';
  return error?.message?.startsWith('Invalid ') ? error.message : 'Something went wrong. Please try again.';
}

export function reportError(context, error) {
  console.error(`[Konoha Notes] ${context}`, error);
}
