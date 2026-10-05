import * as useCases from '../../domain/usecases/auth-use-cases.js';

export class AuthController {
  constructor(repository) { this.repository = repository; }
  observe(callback) { return useCases.observeAuth(this.repository)(callback); }
  register(input) { return useCases.registerUser(this.repository, input); }
  login(input) { return useCases.loginUser(this.repository, input); }
  loginWithGoogle() { return useCases.loginWithGoogle(this.repository); }
  logout() { return useCases.logoutUser(this.repository); }
  resetPassword(email) { return useCases.resetPassword(this.repository, email); }
  resendVerification() { return useCases.resendVerification(this.repository); }
  reloadCurrentUser() { return useCases.reloadCurrentUser(this.repository); }
  getCurrentUser() { return useCases.getCurrentUser(this.repository); }
  checkEmailVerification(user) { return useCases.checkEmailVerification(user); }
}
