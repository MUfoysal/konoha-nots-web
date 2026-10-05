import * as useCases from '../../domain/usecases/settings-use-cases.js';

export class SettingsController {
  constructor(repository) { this.repository = repository; this.state = 'idle'; }
  getProfile() { return useCases.getSettingsProfile(this.repository); }
  getCapabilities() { return this.repository.getCapabilities(); }
  refreshAccount() { return this.repository.refreshAccount(); }
  updateProfile(input) { return useCases.updateSettingsProfile(this.repository, input); }
  changePassword(input) { return useCases.changeSettingsPassword(this.repository, input); }
  requestEmailChange(email, password) { return useCases.requestSettingsEmailChange(this.repository, email, password); }
}
