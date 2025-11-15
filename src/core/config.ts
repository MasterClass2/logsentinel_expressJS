import { Config, LogsentinelConfig } from '../types';
import { logger } from './logger';

/**
 * Load and validate logsentinel configuration from environment variables or explicit config.
 * 
 * Priority: Explicit config > Environment variables > Defaults
 * 
 * Never crashes the app it only warns about missing config.
 */
class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(explicitConfig?: LogsentinelConfig): Config {
    const apiKey = explicitConfig?.apiKey || process.env.LOGSENTINEL_API_KEY || '';
    const baseUrl = explicitConfig?.baseUrl || process.env.LOGSENTINEL_BASE_URL || '';
    const debug = explicitConfig?.debug !== undefined 
      ? explicitConfig.debug 
      : process.env.LOGSENTINEL_DEBUG === 'true';

    // Validate required fields but dont crash
    if (!apiKey) {
      logger.warn('LOGSENTINEL_API_KEY is not set. Logs will not be sent to the server.');
    }

    if (!baseUrl) {
      logger.warn('LOGSENTINEL_BASE_URL is not set. Logs will not be sent to the server.');
    }

    if (debug) {
      logger.debug('Debug mode enabled. All log operations will be printed to console.');
    }

    return {
      apiKey,
      baseUrl,
      debug
    };
  }

  /**
   * Update configuration with explicit values
   */
  updateConfig(explicitConfig: LogsentinelConfig): void {
    this.config = this.loadConfig(explicitConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): Config {
    return { ...this.config };
  }

  /**
   * Check if configuration is valid for sending logs
   */
  isValid(): boolean {
    return !!(this.config.apiKey && this.config.baseUrl);
  }
}

export const configManager = new ConfigManager();
export const getConfig = () => configManager.getConfig();
export const isConfigValid = () => configManager.isValid();
export const updateConfig = (config: LogsentinelConfig) => configManager.updateConfig(config);
