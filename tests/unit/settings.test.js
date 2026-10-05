import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmailAddress, validatePasswordChange, validateProfileInput,
  updateSettingsProfile,
} from '../../public/src/features/settings/domain/usecases/settings-use-cases.js';

test('profile settings normalize editable profile fields and enforce Firestore limits', async () => {
  assert.deepEqual(validateProfileInput({ displayName: '  Mohib  ', clan: '  Writer ' }), { displayName: 'Mohib', clan: 'Writer' });
  assert.throws(() => validateProfileInput({ displayName: ' ', clan: 'Writer' }), /name/);
  assert.throws(() => validateProfileInput({ displayName: 'Name', clan: 'x'.repeat(81) }), /clan/);

  const repository = { updateProfile: async profile => profile };
  assert.deepEqual(await updateSettingsProfile(repository, { displayName: 'New name', clan: 'Leaf' }), { displayName: 'New name', clan: 'Leaf' });
});

test('password change requires current password, confirmation, and a strong new password', () => {
  assert.throws(() => validatePasswordChange({ currentPassword: '', newPassword: 'long-password', confirmPassword: 'long-password' }), /current password/);
  assert.throws(() => validatePasswordChange({ currentPassword: 'old-password', newPassword: 'short', confirmPassword: 'short' }), /10 characters/);
  assert.throws(() => validatePasswordChange({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'different-password' }), /do not match/);
  assert.throws(() => validatePasswordChange({ currentPassword: 'same-password', newPassword: 'same-password', confirmPassword: 'same-password' }), /different/);
  assert.deepEqual(validatePasswordChange({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'new-password' }), { currentPassword: 'old-password', newPassword: 'new-password' });
});

test('email settings trim addresses and reject malformed input', () => {
  assert.equal(validateEmailAddress('  shinobi@example.com  '), 'shinobi@example.com');
  assert.throws(() => validateEmailAddress('not-an-email'), /valid email/);
});
