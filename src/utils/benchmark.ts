// ============================================================================
// BENCHMARK UTILITY - Performance measurement for critical paths
// ============================================================================
// This utility provides simple timing instrumentation to measure and enforce
// PRD performance requirements:
// - Plugin load time: < 2 seconds
// - UI interactions: < 100ms lag
// - Canvas annotation rendering (50+ annotations): < 5 seconds

import { Logger } from "./logger";
import { performanceSettings } from "../store";

interface BenchmarkResult {
  name: string;
  duration: number;
  timestamp: number;
  threshold?: number;
  passed?: boolean;
}

class BenchmarkManager {
  private timers: Map<string, number> = new Map();
  private results: BenchmarkResult[] = [];
  private readonly MAX_STORED_RESULTS = 100;

  /**
   * Start timing a critical operation
   * @param name - Unique identifier for the operation
   */
  start(name: string): void {
    if (!this.isMonitoringEnabled()) return;
    
    this.timers.set(name, performance.now());
    Logger.debug("Benchmark", `Started: ${name}`);
  }

  /**
   * Stop timing and record the result
   * @param name - Unique identifier for the operation
   * @param threshold - Optional performance threshold in ms (logs warning if exceeded)
   * @returns Duration in milliseconds
   */
  stop(name: string, threshold?: number): number {
    if (!this.isMonitoringEnabled()) return 0;

    const startTime = this.timers.get(name);
    if (startTime === undefined) {
      Logger.warn("Benchmark", `Timer not found: ${name}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    const result: BenchmarkResult = {
      name,
      duration,
      timestamp: Date.now(),
      ...(threshold !== undefined && { threshold, passed: duration < threshold }),
    };

    this.results.push(result);

    // Limit stored results to prevent memory issues
    if (this.results.length > this.MAX_STORED_RESULTS) {
      this.results.shift();
    }

    // Log based on performance settings
    const logLevel = performanceSettings.value.logLevel;
    
    if (threshold !== undefined && duration >= threshold) {
      Logger.warn("Benchmark", `⚠️ ${name} exceeded threshold`, {
        duration: `${duration.toFixed(2)}ms`,
        threshold: `${threshold}ms`,
      });
    } else if (logLevel === "detailed") {
      Logger.debug("Benchmark", `✓ ${name} completed`, {
        duration: `${duration.toFixed(2)}ms`,
        threshold: threshold ? `${threshold}ms` : "none",
      });
    } else if (logLevel === "basic" && duration > 100) {
      // Only log slow operations in basic mode
      Logger.debug("Benchmark", `${name}`, {
        duration: `${duration.toFixed(2)}ms`,
      });
    }

    return duration;
  }

  /**
   * Measure a synchronous operation
   * @param name - Unique identifier for the operation
   * @param operation - Function to measure
   * @param threshold - Optional performance threshold in ms
   * @returns Result of the operation
   */
  measure<T>(name: string, operation: () => T, threshold?: number): T {
    if (!this.isMonitoringEnabled()) {
      return operation();
    }

    this.start(name);
    try {
      const result = operation();
      this.stop(name, threshold);
      return result;
    } catch (error) {
      this.stop(name, threshold);
      throw error;
    }
  }

  /**
   * Measure an asynchronous operation
   * @param name - Unique identifier for the operation
   * @param operation - Async function to measure
   * @param threshold - Optional performance threshold in ms
   * @returns Result of the operation
   */
  async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    threshold?: number
  ): Promise<T> {
    if (!this.isMonitoringEnabled()) {
      return await operation();
    }

    this.start(name);
    try {
      const result = await operation();
      this.stop(name, threshold);
      return result;
    } catch (error) {
      this.stop(name, threshold);
      throw error;
    }
  }

  /**
   * Get all benchmark results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get results for a specific operation name
   */
  getResultsByName(name: string): BenchmarkResult[] {
    return this.results.filter((r) => r.name === name);
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    failed: number;
  } | null {
    const results = this.getResultsByName(name);
    if (results.length === 0) return null;

    const durations = results.map((r) => r.duration);
    const failed = results.filter((r) => r.passed === false).length;

    return {
      count: results.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      failed,
    };
  }

  /**
   * Clear all stored results
   */
  clear(): void {
    this.results = [];
    this.timers.clear();
  }

  /**
   * Export results as JSON for external analysis
   */
  export(): string {
    return JSON.stringify(
      {
        results: this.results,
        timestamp: Date.now(),
        enabled: this.isMonitoringEnabled(),
      },
      null,
      2
    );
  }

  /**
   * Check if performance monitoring is enabled
   */
  private isMonitoringEnabled(): boolean {
    return performanceSettings.value.enableMonitoring;
  }
}

// Singleton instance
export const benchmark = new BenchmarkManager();

// Export types
export type { BenchmarkResult };

// Convenience exports for common thresholds (from PRD)
export const PERFORMANCE_THRESHOLDS = {
  PLUGIN_LOAD: 2000, // Plugin load time: < 2 seconds
  UI_INTERACTION: 100, // UI interactions: < 100ms lag
  CANVAS_RENDER_50: 5000, // Canvas annotation rendering (50+ annotations): < 5 seconds
  CANVAS_INSERT: 1000, // Individual canvas insert: < 1 second
  ANNOTATION_LIST_RENDER: 50, // List render: < 50ms
} as const;
