import test from 'node:test';
import assert from 'node:assert/strict';
import { userMessage } from '../../public/src/core/errors/app-error.js';
import { checkEmailVerification } from '../../public/src/features/auth/domain/usecases/auth-use-cases.js';

test('email verification uses the Firebase user value and defaults safely', () => {
  assert.equal(checkEmailVerification({ emailVerified: true }), true);
  assert.equal(checkEmailVerification({ emailVerified: false }), false);
  assert.equal(checkEmailVerification(null), false);
});

test('login and network errors map to actionable user-facing messages', () => {
  assert.equal(userMessage({ code: 'auth/invalid-credential' }), 'Email or password is incorrect. Please check your credentials and try again.');
  assert.equal(userMessage({ code: 'auth/invalid-email' }), 'Please enter a valid email address.');
  assert.equal(userMessage({ code: 'konoha/email-not-verified' }), 'Please verify your email before signing in.');
  assert.equal(userMessage({ code: 'auth/too-many-requests' }), 'Too many attempts. Please wait a moment and try again.');
  assert.equal(userMessage({ code: 'auth/network-request-failed' }), 'Unable to connect. Please check your internet connection and try again.');
});

test('unexpected Firebase details are not shown to the user', () => {
  assert.equal(userMessage({ code: 'auth/internal-error', message: 'Firebase internal exception detail' }), 'Something went wrong. Please try again.');
});
