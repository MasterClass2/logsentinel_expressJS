import { Request, Response, NextFunction } from 'express';
import { LogEvent, RequestLog, ResponseLog, ErrorLog } from '../types';
import { logger } from '../core/logger';
import { logQueue } from '../core/sender';
import { sanitize, sanitizeHeaders, capSize, isBinaryContent, isMultipartForm } from '../utils/formatter';
import { now, startTimer, duration } from '../utils/time';

/**
 * Generate a unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main logsentinel middleware that captures all requests, responses, and errors
 * 
 * Critical features:
 * - Captures full request data (method, URL, headers, body, query)
 * - Monkey-patches response methods to capture response body (this is abit tough)
 * - Handles errors via error middleware
 * - Non-blocking: just pushes to queue immediately
 * - aviods crashing the app
 */
export function logsentinelMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = generateRequestId();
    const startTime = startTimer();

    // Attach the generated request ID to request
    (req as any).requestId = requestId;

    logger.debug(`Request started: ${req.method} ${req.path}`, { requestId });

    // Capture request data
    const requestLog: RequestLog = {
      method: req.method,
      url: req.originalUrl || req.url,
      path: req.path,
      query: { ...req.query },
      headers: sanitizeHeaders({ ...req.headers }),
      body: undefined,
      ip: req.ip || req.socket.remoteAddress
    };

    // Capture request body (already parsed by body-parser/express.json)
    if (req.body && Object.keys(req.body).length > 0) {
      const contentType = req.get('content-type');
      
      if (isMultipartForm(contentType)) {
        requestLog.body = '[multipart/form-data]';
      } else if (isBinaryContent(contentType)) {
        requestLog.body = '[binary data]';
      } else {
        requestLog.body = capSize(sanitize(req.body));
      }
    }

    // Variables to capture response
    let responseLog: ResponseLog | undefined;
    let errorLog: ErrorLog | undefined;

    // Store original response methods
    const originalSend = res.send;
    const originalJson = res.json;
    const originalEnd = res.end;

    // Flag to ensure we only capture once
    let responseCaptured = false;

    /**
     * Capture response body from any response method
     */
    const captureResponse = (body: any) => {
      if (responseCaptured) return;
      responseCaptured = true;

      const contentType = res.get('content-type');

      responseLog = {
        statusCode: res.statusCode,
        headers: sanitizeHeaders(res.getHeaders() as Record<string, any>),
        contentType,
        body: undefined
      };

      // Don't capture binary or large content
      if (isBinaryContent(contentType)) {
        responseLog.body = '[binary data]';
      } else if (isMultipartForm(contentType)) {
        responseLog.body = '[multipart/form-data]';
      } else if (body) {
        try {
          // Handle different body types
          if (Buffer.isBuffer(body)) {
            responseLog.body = capSize(body.toString('utf8'));
          } else if (typeof body === 'string') {
            responseLog.body = capSize(body);
          } else if (typeof body === 'object') {
            responseLog.body = capSize(sanitize(body));
          } else {
            responseLog.body = String(body);
          }
        } catch (error) {
          logger.warn('Failed to capture response body', error as Error);
          responseLog.body = '[capture failed]';
        }
      }

      logger.debug(`Response captured: ${res.statusCode}`, { requestId, body: responseLog.body });
    };

    // Monkey-patch res.send
    res.send = function(body: any) {
      captureResponse(body);
      return originalSend.call(this, body);
    };

    // Monkey-patch res.json
    res.json = function(body: any) {
      captureResponse(body);
      return originalJson.call(this, body);
    };

    // Monkey-patch res.end
    res.end = function(chunk?: any, encoding?: any, callback?: any) {
      captureResponse(chunk);
      return originalEnd.call(this, chunk, encoding, callback);
    };

    // Listen for response finish event
    res.on('finish', () => {
      const durationMs = duration(startTime);

      // If response wasn't captured yet (e.g no body sent)
      if (!responseCaptured) {
        responseLog = {
          statusCode: res.statusCode,
          headers: sanitizeHeaders(res.getHeaders() as Record<string, any>),
          contentType: res.get('content-type')
        };
      }

      // Create log event
      const logEvent: LogEvent = {
        timestamp: now(),
        duration: durationMs,
        requestId,
        request: requestLog,
        response: responseLog,
        error: errorLog
      };

      logger.debug(`Request completed in ${durationMs}ms`, { requestId, statusCode: res.statusCode });

      // Push to queue (non-blocking)
      try {
        logQueue.push(logEvent);
      } catch (error) {
        logger.warn('Failed to push log to queue', error as Error);
      }
    });

    // Continue to next middleware
    next();
  };
}

/**
 * Error handling middleware==> must be registered after all other middleware
 * 
 * Captures error details and attaches to the log event
 */
export function logsentinelErrorMiddleware() {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).requestId;

    logger.debug(`Error occurred: ${err.message}`, { requestId });

    // Attach error to response locals so main middleware can capture it
    res.locals.logsentinelError = {
      message: err.message,
      stack: err.stack,
      statusCode: res.statusCode || 500
    };

    // Re-throw error so app's error handler can process it
    next(err);
  };
}
