import { AuthRepository } from '../../domain/repositories/auth-repository.js';
export class FirebaseAuthRepository extends AuthRepository {
  constructor(dataSource) { super(); this.dataSource = dataSource; }
  observe(callback) { return this.dataSource.observe(callback); }
  register(input) { return this.dataSource.register(input); }
  login(input) { return this.dataSource.login(input); }
  loginWithGoogle() { return this.dataSource.loginWithGoogle(); }
  logout() { return this.dataSource.logout(); }
  sendPasswordReset(email) { return this.dataSource.sendPasswordReset(email); }
  resendVerification() { return this.dataSource.resendVerification(); }
  reloadCurrentUser() { return this.dataSource.reloadCurrentUser(); }
  getCurrentUser() { return this.dataSource.getCurrentUser(); }
}
