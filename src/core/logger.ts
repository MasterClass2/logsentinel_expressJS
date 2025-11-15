/**
 * Internal logger for the logsentinel SDK
 * Checks debug flag directly from environment to avoid circular dependency with config
 */
class Logger {
  private shouldLog(): boolean {
    return process.env.LOGSENTINEL_DEBUG === 'true';
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog()) return;
    
    try {
      if (data) {
        console.log(`[logsentinel] DEBUG: ${message}`, data);
      } else {
        console.log(`[logsentinel] DEBUG: ${message}`);
      }
    } catch (error) {
      // Silent failure - never crash the app
    }
  }

  warn(message: string, error?: any): void {
    // Warnings always show (not gated by debug flag)
    try {
      if (error) {
        console.warn(`[logsentinel] WARNING: ${message}`, error);
      } else {
        console.warn(`[logsentinel] WARNING: ${message}`);
      }
    } catch (err) {
      // Silent failure - never crash the app
    }
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog()) return;
    
    try {
      if (data) {
        console.info(`[logsentinel] INFO: ${message}`, data);
      } else {
        console.info(`[logsentinel] INFO: ${message}`);
      }
    } catch (error) {
      // Silent failure - never crash the app
    }
  }

  error(message: string, error?: any): void {
    // Errors always show (not gated by debug flag)
    try {
      if (error) {
        console.error(`[logsentinel] ERROR: ${message}`, error);
      } else {
        console.error(`[logsentinel] ERROR: ${message}`);
      }
    } catch (err) {
      // Silent failure - never crash the app
    }
  }
}

export const logger = new Logger();
