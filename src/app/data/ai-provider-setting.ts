/** Value of the `ai_provider` row of table `app_setting`. The provider key never leaves the server. */
export interface AiProviderSetting {
  readonly baseUrl: string;
  readonly model: string;
}
