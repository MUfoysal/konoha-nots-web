import { SettingsRepository } from '../../domain/repositories/settings-repository.js';

export class FirebaseSettingsRepository extends SettingsRepository {
  constructor(dataSource) { super(); this.dataSource = dataSource; }
  getProfile() { return this.dataSource.getProfile(); }
  getCapabilities() { return this.dataSource.getCapabilities(); }
  refreshAccount() { return this.dataSource.refreshAccount(); }
  updateProfile(input) { return this.dataSource.updateProfile(input); }
  changePassword(input) { return this.dataSource.changePassword(input); }
  requestEmailChange(email, password) { return this.dataSource.requestEmailChange(email, password); }
}
