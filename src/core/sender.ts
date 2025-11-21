import axios, { AxiosError } from 'axios';
import { LogEvent, TransformedLogEvent } from '../types';
import { getConfig, isConfigValid } from './config';
import { logger } from './logger';

/**
 * Maximum number of logs to keep in memory before dropping oldest
 */
const MAX_QUEUE_SIZE = 1000;

/**
 * Batch size  (flush when queue reaches this many logs
 */
const BATCH_SIZE = 50;

/**
 * Time-based flush interval in milliseconds (5 seconds)
 */
const FLUSH_INTERVAL = 5000;

/**
 * Maximum number of retry attempts
 */
const MAX_RETRIES = 3;

/**
 * Initial retry delay in milliseconds
 */
const INITIAL_RETRY_DELAY = 1000;

/**
 * Async queue for sending logs without blocking the main app.
 * 
 * Features:
 * - Dual flush trigger: size (50 logs) OR time (5 seconds) whichever will come first
 * - Memory safety: drops oldest logs if queue exceeds 1000
 * - Retry logic with exponential backoff
 * - Non-blocking: never slows down the apps' request handling
 */
class LogQueue {
  private queue: LogEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private isShuttingDown = false;

  constructor() {
    this.startFlushTimer();
    this.setupGracefulShutdown();
  }

  /**
   * Add a log event to the queue (non-blocking)
   */
  push(event: LogEvent): void {
    if (this.isShuttingDown) {
      logger.debug('Queue is shutting down, dropping log');
      return;
    }

    // Memory safety: drop oldest logs if queue is full
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.warn(`Queue size exceeded ${MAX_QUEUE_SIZE}, dropping oldest log`);
      this.queue.shift();
    }

    this.queue.push(event);
    logger.debug(`Log added to queue. Queue size: ${this.queue.length}`);

    // Trigger flush if batch size reached
    if (this.queue.length >= BATCH_SIZE) {
      logger.debug('Batch size reached, triggering flush');
      this.flush();
    }
  }

  /**
   * Start time-based flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.queue.length > 0) {
        logger.debug('Flush interval reached, triggering flush');
        this.flush();
      }
    }, FLUSH_INTERVAL);
  }

  /**
   * Flush the queue (send all logs to server)
   * Non-blocking  (asynchronously)
   */
  private flush(): void {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Take a snapshot of current queue and clear it immediately
    const logsToSend = [...this.queue];
    this.queue = [];

    logger.debug(`Flushing ${logsToSend.length} logs to server`);

    // Send asynchronously without blocking
    this.sendBatch(logsToSend)
      .catch(error => {
        logger.warn('Failed to send batch after all retries', error);
      })
      .finally(() => {
        this.isFlushing = false;
      });
  }

  /**
   * Send a batch of logs with retry logic
   */
  private async sendBatch(logs: LogEvent[], attempt: number = 1): Promise<void> {
    if (!isConfigValid()) {
      logger.debug('Config invalid, skipping log send');
      return;
    }

    const config = getConfig();

    try {
      const endpoint = `${config.baseUrl}/api/sdk/logs`;
      logger.debug(`Sending batch attempt ${attempt}/${MAX_RETRIES}`, {
        count: logs.length,
        url: endpoint
      });

      // Transform logs to match expected server format
      const transformedLogs: TransformedLogEvent[] = logs.map(log => ({
        timestamp: log.timestamp,
        trace_id: log.requestId || `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        request: {
          method: log.request.method,
          path: log.request.path,
          headers: log.request.headers,
          body: log.request.body ? JSON.stringify(log.request.body) : null,
          ip: log.request.ip || null
        },
        response: {
          status: log.response?.statusCode || 0,
          headers: log.response?.headers || {},
          body: log.response?.body ? JSON.stringify(log.response.body) : null,
          duration_ms: log.duration
        }
      }));

      // Log sample for debugging
      if (transformedLogs.length > 0) {
        logger.debug('Sample transformed log entry:', {
          trace_id: transformedLogs[0].trace_id,
          method: transformedLogs[0].request.method,
          path: transformedLogs[0].request.path,
          status: transformedLogs[0].response.status,
          duration: transformedLogs[0].response.duration_ms,
          hasRequestBody: !!transformedLogs[0].request.body,
          hasResponseBody: !!transformedLogs[0].response.body,
          responseBodyPreview: transformedLogs[0].response.body?.substring(0, 100)
        });
      }

      // Send each log individually. In future we can optimize to send in bulk if server supports it  
      let successCount = 0;
      for (const transformedLog of transformedLogs) {
        const response = await axios.post(
          endpoint,
          transformedLog,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
              'User-Agent': 'logsentinel-express/1.0.0'
            },
            timeout: 10000
          }
        );

        if (response.status >= 200 && response.status < 300) {
          successCount++;
        }
      }

      logger.debug(`Batch sent successfully. ${successCount}/${transformedLogs.length} logs delivered`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.message;

      logger.warn(`Batch send failed (attempt ${attempt}): ${message} (status: ${status})`);

      // Retry with exponential backoff if not max attempts
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
        logger.debug(`Retrying in ${delay}ms...`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendBatch(logs, attempt + 1);
      }

      // Max retries reached
      throw new Error(`Failed to send batch after ${MAX_RETRIES} attempts: ${message}`);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.debug('Shutting down logsentinel queue...');
      this.isShuttingDown = true;

      // Stop the flush timer
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      // Flush any remaining logs
      if (this.queue.length > 0) {
        logger.debug(`Flushing ${this.queue.length} remaining logs before shutdown`);
        const logsToSend = [...this.queue];
        this.queue = [];
        
        try {
          await this.sendBatch(logsToSend);
          logger.debug('Final flush completed successfully');
        } catch (error) {
          logger.warn('Failed to flush remaining logs during shutdown', error as Error);
        }
      }

      logger.debug('Logsentinel queue shutdown complete');
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Get current queue size (for testing)
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

export const logQueue = new LogQueue();
