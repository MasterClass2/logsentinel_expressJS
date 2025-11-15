import {
  sanitize,
  sanitizeHeaders,
  capSize,
  safeStringify,
  isBinaryContent,
  isMultipartForm
} from '../utils/formatter';

describe('Formatter', () => {
  describe('sanitize', () => {
    it('should redact sensitive fields', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        apiKey: 'key123',
        token: 'token123'
      };

      const result = sanitize(input);

      expect(result.username).toBe('john');
      expect(result.password).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const input = {
        user: {
          name: 'john',
          password: 'secret'
        },
        auth: {
          token: 'token123'
        }
      };

      const result = sanitize(input);

      expect(result.user.name).toBe('john');
      expect(result.user.password).toBe('[REDACTED]');
      expect(result.auth.token).toBe('[REDACTED]');
    });

    it('should handle arrays', () => {
      const input = [
        { name: 'john', password: 'secret' },
        { name: 'jane', apiKey: 'key123' }
      ];

      const result = sanitize(input);

      expect(result[0].name).toBe('john');
      expect(result[0].password).toBe('[REDACTED]');
      expect(result[1].name).toBe('jane');
      expect(result[1].apiKey).toBe('[REDACTED]');
    });

    it('should handle circular references', () => {
      const input: any = { name: 'john' };
      input.self = input;

      const result = sanitize(input);

      expect(result.name).toBe('john');
      expect(result.self).toBe('[Circular Reference]');
    });

    it('should handle null and undefined', () => {
      expect(sanitize(null)).toBe(null);
      expect(sanitize(undefined)).toBe(undefined);
    });

    it('should handle primitives', () => {
      expect(sanitize('string')).toBe('string');
      expect(sanitize(123)).toBe(123);
      expect(sanitize(true)).toBe(true);
    });
  });

  describe('sanitizeHeaders', () => {
    it('should redact authorization header', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token123'
      };

      const result = sanitizeHeaders(headers);

      expect(result['content-type']).toBe('application/json');
      expect(result['authorization']).toBe('[REDACTED]');
    });

    it('should redact cookie header', () => {
      const headers = {
        'cookie': 'session=abc123'
      };

      const result = sanitizeHeaders(headers);

      expect(result['cookie']).toBe('[REDACTED]');
    });

    it('should redact x-api-key header', () => {
      const headers = {
        'x-api-key': 'key123'
      };

      const result = sanitizeHeaders(headers);

      expect(result['x-api-key']).toBe('[REDACTED]');
    });
  });

  describe('capSize', () => {
    it('should not modify small strings', () => {
      const input = 'small string';
      const result = capSize(input);

      expect(result).toBe(input);
    });

    it('should truncate large strings', () => {
      const input = 'a'.repeat(20000);
      const result = capSize(input);

      expect(result.length).toBeLessThan(input.length);
      expect(result).toContain('[truncated]');
    });

    it('should cap object size after stringification', () => {
      const input = { data: 'a'.repeat(20000) };
      const result = capSize(input);

      if (typeof result === 'string') {
        expect(result).toContain('[truncated]');
      }
    });

    it('should handle null and undefined', () => {
      expect(capSize(null)).toBe(null);
      expect(capSize(undefined)).toBe(undefined);
    });
  });

  describe('safeStringify', () => {
    it('should stringify simple objects', () => {
      const input = { name: 'john', age: 30 };
      const result = safeStringify(input);

      expect(result).toBe(JSON.stringify(input));
    });

    it('should handle circular references', () => {
      const input: any = { name: 'john' };
      input.self = input;

      const result = safeStringify(input);

      expect(result).toContain('[Circular Reference]');
    });

    it('should handle Error objects', () => {
      const error = new Error('test error');
      const result = safeStringify({ error });

      expect(result).toContain('test error');
      expect(result).toContain('stack');
    });

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01');
      const result = safeStringify({ date });

      expect(result).toContain('2024-01-01');
    });

    it('should handle functions', () => {
      const input = { func: () => {} };
      const result = safeStringify(input);

      expect(result).toContain('[Function]');
    });
  });

  describe('isBinaryContent', () => {
    it('should detect image content', () => {
      expect(isBinaryContent('image/png')).toBe(true);
      expect(isBinaryContent('image/jpeg')).toBe(true);
    });

    it('should detect video content', () => {
      expect(isBinaryContent('video/mp4')).toBe(true);
    });

    it('should detect audio content', () => {
      expect(isBinaryContent('audio/mpeg')).toBe(true);
    });

    it('should not detect text content as binary', () => {
      expect(isBinaryContent('text/plain')).toBe(false);
      expect(isBinaryContent('application/json')).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isBinaryContent(undefined)).toBe(false);
    });
  });

  describe('isMultipartForm', () => {
    it('should detect multipart form data', () => {
      expect(isMultipartForm('multipart/form-data')).toBe(true);
      expect(isMultipartForm('multipart/form-data; boundary=----')).toBe(true);
    });

    it('should not detect other content types', () => {
      expect(isMultipartForm('application/json')).toBe(false);
      expect(isMultipartForm('text/plain')).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isMultipartForm(undefined)).toBe(false);
    });
  });
});
