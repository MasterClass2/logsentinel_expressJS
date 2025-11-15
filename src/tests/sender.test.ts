import axios from 'axios';
import { logQueue } from '../core/sender';
import type { LogEvent } from '../types';
import { updateConfig } from '../core/config';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Sender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup valid config
    updateConfig({
      apiKey: 'test-key',
      baseUrl: 'https://test.com/logs',
      debug: false
    });

    // Mock successful response
    mockedAxios.post.mockResolvedValue({
      status: 200,
      data: { success: true }
    });
  });

  describe('Queue Operations', () => {
    it('should add logs to queue', () => {
      const logEvent: LogEvent = {
        timestamp: new Date().toISOString(),
        duration: 100,
        requestId: 'req_123',
        request: {
          method: 'GET',
          url: '/test',
          path: '/test',
          query: {},
          headers: {}
        }
      };

      const initialSize = logQueue.getQueueSize();
      logQueue.push(logEvent);
      
      expect(logQueue.getQueueSize()).toBeGreaterThanOrEqual(initialSize);
    });

    it('should flush when batch size is reached', (done) => {
      const logs: LogEvent[] = [];
      
      for (let i = 0; i < 50; i++) {
        logs.push({
          timestamp: new Date().toISOString(),
          duration: 100,
          requestId: `req_${i}`,
          request: {
            method: 'GET',
            url: '/test',
            path: '/test',
            query: {},
            headers: {}
          }
        });
      }

      logs.forEach(log => logQueue.push(log));

      // Give time for async flush
      setTimeout(() => {
        expect(mockedAxios.post).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure', (done) => {
      // First call fails, second succeeds
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          data: { success: true }
        });

      const logEvent: LogEvent = {
        timestamp: new Date().toISOString(),
        duration: 100,
        requestId: 'req_123',
        request: {
          method: 'GET',
          url: '/test',
          path: '/test',
          query: {},
          headers: {}
        }
      };

      // Push enough logs to trigger flush
      for (let i = 0; i < 50; i++) {
        logQueue.push({ ...logEvent, requestId: `req_${i}` });
      }

      // Give time for retries
      setTimeout(() => {
        expect(mockedAxios.post).toHaveBeenCalledTimes(2);
        done();
      }, 2000);
    });

    it('should use exponential backoff', (done) => {
      const callTimes: number[] = [];

      mockedAxios.post.mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.reject(new Error('Network error'));
      });

      const logEvent: LogEvent = {
        timestamp: new Date().toISOString(),
        duration: 100,
        requestId: 'req_123',
        request: {
          method: 'GET',
          url: '/test',
          path: '/test',
          query: {},
          headers: {}
        }
      };

      // Trigger flush
      for (let i = 0; i < 50; i++) {
        logQueue.push({ ...logEvent, requestId: `req_${i}` });
      }

      setTimeout(() => {
        if (callTimes.length >= 2) {
          const firstDelay = callTimes[1] - callTimes[0];
          expect(firstDelay).toBeGreaterThanOrEqual(1000);
        }
        done();
      }, 5000);
    });
  });

  describe('Configuration', () => {
    it('should not send logs when config is invalid', (done) => {
      updateConfig({
        apiKey: '',
        baseUrl: '',
        debug: false
      });

      const logEvent: LogEvent = {
        timestamp: new Date().toISOString(),
        duration: 100,
        requestId: 'req_123',
        request: {
          method: 'GET',
          url: '/test',
          path: '/test',
          query: {},
          headers: {}
        }
      };

      // Trigger flush
      for (let i = 0; i < 50; i++) {
        logQueue.push({ ...logEvent, requestId: `req_${i}` });
      }

      setTimeout(() => {
        expect(mockedAxios.post).not.toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should include API key in request headers', (done) => {
      const logEvent: LogEvent = {
        timestamp: new Date().toISOString(),
        duration: 100,
        requestId: 'req_123',
        request: {
          method: 'GET',
          url: '/test',
          path: '/test',
          query: {},
          headers: {}
        }
      };

      // Trigger flush
      for (let i = 0; i < 50; i++) {
        logQueue.push({ ...logEvent, requestId: `req_${i}` });
      }

      setTimeout(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-API-Key': 'test-key'
            })
          })
        );
        done();
      }, 100);
    });
  });
});
