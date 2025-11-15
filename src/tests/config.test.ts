import { configManager, getConfig, isConfigValid, updateConfig } from '../core/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should load config from environment variables', () => {
      process.env.LOGSENTINEL_API_KEY = 'test-key';
      process.env.LOGSENTINEL_BASE_URL = 'https://test.com';
      process.env.LOGSENTINEL_DEBUG = 'true';

      const config = getConfig();

      expect(config.apiKey).toBe('test-key');
      expect(config.baseUrl).toBe('https://test.com');
      expect(config.debug).toBe(true);
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.LOGSENTINEL_API_KEY;
      delete process.env.LOGSENTINEL_BASE_URL;

      const config = getConfig();

      expect(config.apiKey).toBe('');
      expect(config.baseUrl).toBe('');
      expect(config.debug).toBe(false);
    });

    it('should default debug to false when not set', () => {
      delete process.env.LOGSENTINEL_DEBUG;

      const config = getConfig();

      expect(config.debug).toBe(false);
    });
  });

  describe('updateConfig', () => {
    it('should update config with explicit values', () => {
      updateConfig({
        apiKey: 'new-key',
        baseUrl: 'https://new-url.com',
        debug: true
      });

      const config = getConfig();

      expect(config.apiKey).toBe('new-key');
      expect(config.baseUrl).toBe('https://new-url.com');
      expect(config.debug).toBe(true);
    });

    it('should allow partial updates', () => {
      process.env.LOGSENTINEL_API_KEY = 'env-key';
      process.env.LOGSENTINEL_BASE_URL = 'https://env-url.com';

      updateConfig({
        debug: true
      });

      const config = getConfig();

      expect(config.apiKey).toBe('env-key');
      expect(config.baseUrl).toBe('https://env-url.com');
      expect(config.debug).toBe(true);
    });
  });

  describe('isConfigValid', () => {
    it('should return true when both apiKey and baseUrl are set', () => {
      updateConfig({
        apiKey: 'test-key',
        baseUrl: 'https://test.com'
      });

      expect(isConfigValid()).toBe(true);
    });

    it('should return false when apiKey is missing', () => {
      updateConfig({
        apiKey: '',
        baseUrl: 'https://test.com'
      });

      expect(isConfigValid()).toBe(false);
    });

    it('should return false when baseUrl is missing', () => {
      updateConfig({
        apiKey: 'test-key',
        baseUrl: ''
      });

      expect(isConfigValid()).toBe(false);
    });

    it('should return false when both are missing', () => {
      updateConfig({
        apiKey: '',
        baseUrl: ''
      });

      expect(isConfigValid()).toBe(false);
    });
  });
});
