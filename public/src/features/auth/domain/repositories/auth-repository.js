export class AuthRepository {
  observe() { throw new Error('AuthRepository.observe must be implemented'); }
  register() { throw new Error('AuthRepository.register must be implemented'); }
  login() { throw new Error('AuthRepository.login must be implemented'); }
  loginWithGoogle() { throw new Error('AuthRepository.loginWithGoogle must be implemented'); }
  logout() { throw new Error('AuthRepository.logout must be implemented'); }
  sendPasswordReset() { throw new Error('AuthRepository.sendPasswordReset must be implemented'); }
  resendVerification() { throw new Error('AuthRepository.resendVerification must be implemented'); }
  reloadCurrentUser() { throw new Error('AuthRepository.reloadCurrentUser must be implemented'); }
  getCurrentUser() { throw new Error('AuthRepository.getCurrentUser must be implemented'); }
}
