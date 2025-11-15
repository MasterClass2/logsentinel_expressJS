import { Application } from 'express';
import { logsentinelMiddleware, logsentinelErrorMiddleware } from './middleware/logsentinelMiddleware';
import { updateConfig } from './core/config';
import { logger } from './core/logger';
import { LogsentinelConfig } from './types';

/**
 * Setup logsentinel on an Express app.
 * 
 * This is the main entry point for the SDK. Simply call this function
 * with your Express app instance and logsentinel will automatically
 * capture all requests, responses, and errors.
 * 
 * @param app - Express application instance
 * @param config - Optional configuration (overrides environment variables)
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { setupLogsentinel } from 'logsentinel';
 * 
 * const app = express();
 * 
 * // Setup logsentinel
 * setupLogsentinel(app);
 * 
 * // Your routes...
 * app.get('/', (req, res) => {
 *   res.json({ message: 'Hello World' });
 * });
 * 
 * app.listen(3000);
 * ```
 */
export function setupLogsentinel(app: Application, config?: LogsentinelConfig): void {
  try {
    logger.debug('Initializing logsentinel...');

    // Update config if explicit values provided
    if (config) {
      updateConfig(config);
    }

    // Register main middleware early in the chain
    app.use(logsentinelMiddleware());

    logger.debug('Logsentinel middleware registered');

    // Register error middleware
    // Note: This must be added after all routes but we can't control that here.
    // Users should manually add error middleware if they want error capture,
    // or we register it and it catches errors from previous middleware.
    app.use(logsentinelErrorMiddleware());

    logger.debug('Logsentinel error middleware registered');
    logger.debug('Logsentinel initialization complete');
  } catch (error) {
    logger.warn('Failed to setup logsentinel', error as Error);
    // Never crash the app
  }
}

// Export types for TypeScript users
export type * from './types';
