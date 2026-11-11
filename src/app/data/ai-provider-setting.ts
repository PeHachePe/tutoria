/** Value of the `ai_provider` row of table `app_setting`. The provider key never leaves the server. */
export interface AiProviderSetting {
  readonly baseUrl: string;
  readonly model: string;
  /** The model that answers when the main one fails, of the same provider (D-044). */
  readonly fallbackModel?: string;
}
