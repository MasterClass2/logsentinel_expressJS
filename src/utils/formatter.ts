import { logger } from '../core/logger';

/**
 * Maximum size for request/response bodies (10KB)
 */
const MAX_BODY_SIZE = 10 * 1024;

/**
 * Sensitive data patterns to redact from logs
 */
const SENSITIVE_PATTERNS = [
  /password/gi,
  /token/gi,
  /api[_-]?key/gi,
  /secret/gi,
  /authorization/gi,
  /bearer/gi,
  /auth/gi,
  /credit[_-]?card/gi,
  /ssn/gi,
  /social[_-]?security/gi
];

/**
 * Sanitize an object by redacting sensitive fields and handling circular references
 */
export function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  try {
    return recursiveSanitize(obj, new WeakSet());
  } catch (error) {
    logger.warn('Failed to sanitize object', error as Error);
    return '[sanitization failed]';
  }
}

/**
 * Recursively sanitize an object with circular reference detection
 */
function recursiveSanitize(obj: any, seen: WeakSet<any>): any {
  // Handle primitives
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj)) {
    return '[Circular Reference]';
  }
  seen.add(obj);

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => recursiveSanitize(item, seen));
  }

  // Handle objects
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Check if key is sensitive
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = recursiveSanitize(value, seen);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Cap body size and stringify it  safely
 * 
 * @param body - Request or response body
 * @returns Sanitized and size-capped body
 */
export function capSize(body: any): any {
  if (!body) {
    return body;
  }

  try {
    // If already a string, check its size
    if (typeof body === 'string') {
      if (body.length > MAX_BODY_SIZE) {
        logger.debug(`Body size ${body.length} exceeds limit, truncating to ${MAX_BODY_SIZE}`);
        return body.substring(0, MAX_BODY_SIZE) + '... [truncated]';
      }
      return body;
    }

    // For objects, stringify first then check size
    const stringified = safeStringify(body);
    if (stringified.length > MAX_BODY_SIZE) {
      logger.debug(`Body size ${stringified.length} exceeds limit, truncating to ${MAX_BODY_SIZE}`);
      return stringified.substring(0, MAX_BODY_SIZE) + '... [truncated]';
    }

    // Return original object if within size limit
    return body;
  } catch (error) {
    logger.warn('Failed to cap body size', error as Error);
    return '[size capping failed]';
  }
}

/**
 * Safely stringify an object, handling circular references
 */
export function safeStringify(obj: any): string {
  try {
    const seen = new WeakSet();
    
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      
      // Handle special types
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      if (typeof value === 'function') {
        return '[Function]';
      }
      
      if (typeof value === 'undefined') {
        return '[undefined]';
      }
      
      return value;
    });
  } catch (error) {
    logger.warn('Failed to stringify object', error as Error);
    return '[stringify failed]';
  }
}

/**
 * Format headers by removing sensitive data
 */
export function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Redact sensitive headers
    if (lowerKey === 'authorization' || 
        lowerKey === 'cookie' || 
        lowerKey === 'x-api-key' ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Check if content is binary data
 */
export function isBinaryContent(contentType?: string): boolean {
  if (!contentType) return false;
  
  const binaryTypes = [
    'image/',
    'audio/',
    'video/',
    'application/octet-stream',
    'application/pdf',
    'application/zip'
  ];
  
  return binaryTypes.some(type => contentType.includes(type));
}

/**
 * Check if content is multipart form data
 */
export function isMultipartForm(contentType?: string): boolean {
  return contentType?.includes('multipart/form-data') || false;
}
