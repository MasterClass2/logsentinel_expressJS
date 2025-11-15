/**
 * Time utilities for tracking request durations and timestamps.
 * 
 * Uses high-resolution time for accurate duration measurements.
 */

/**
 * Get current timestamp in ISO 8601 format
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Calculate duration in milliseconds from a start time
 * 
 * @param start - Start time from process.hrtime()
 * @returns Duration in milliseconds
 */
export function duration(start: [number, number]): number {
  const [seconds, nanoseconds] = process.hrtime(start);
  return Math.round(seconds * 1000 + nanoseconds / 1000000);
}

/**
 * Get high-resolution start time for duration tracking
 */
export function startTimer(): [number, number] {
  return process.hrtime();
}
