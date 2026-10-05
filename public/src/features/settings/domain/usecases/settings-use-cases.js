const inputError = message => Object.assign(new Error(message), { name: 'KonohaInputError' });

export function validateProfileInput({ displayName, clan }) {
  const normalized = { displayName: String(displayName || '').trim(), clan: String(clan || '').trim() };
  if (!normalized.displayName || normalized.displayName.length > 120) throw inputError('Enter a name between 1 and 120 characters.');
  if (!normalized.clan || normalized.clan.length > 80) throw inputError('Enter a role or clan name up to 80 characters.');
  return normalized;
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword) throw inputError('Enter your current password.');
  if (!newPassword) throw inputError('Enter a new password.');
  if (!confirmPassword) throw inputError('Confirm your new password.');
  if (newPassword.length < 10) throw inputError('Choose a new password with at least 10 characters.');
  if (newPassword !== confirmPassword) throw inputError('The new passwords do not match.');
  if (newPassword === currentPassword) throw inputError('Choose a password different from your current password.');
  return { currentPassword, newPassword };
}

export function validateEmailAddress(email) {
  const normalized = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw inputError('Enter a valid email address.');
  return normalized;
}

export const getSettingsProfile = repository => repository.getProfile();
export const updateSettingsProfile = (repository, input) => repository.updateProfile(validateProfileInput(input));
export const changeSettingsPassword = (repository, input) => repository.changePassword(validatePasswordChange(input));
export const requestSettingsEmailChange = (repository, email, password) => repository.requestEmailChange(validateEmailAddress(email), password);
