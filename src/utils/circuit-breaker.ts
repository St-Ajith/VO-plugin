// ============================================================================
// CIRCUIT BREAKER - Per-operation failure protection for canvas operations
// ============================================================================
// Implements the circuit breaker pattern to prevent cascading failures when
// canvas operations fail repeatedly. Each operation type (keyed by message type)
// has its own independent circuit breaker.
//
// States:
// - CLOSED: Normal operation, requests pass through
// - OPEN: Breaker tripped, requests are blocked
// - HALF_OPEN: Cooldown passed, allowing one test request
//
// Configuration:
// - failureThreshold: 3 failures within window trips the breaker
// - failureWindowMs: 5000ms sliding window for counting failures
// - cooldownMs: 30000ms before auto-reset to HALF_OPEN
// ============================================================================

import { emit } from "@create-figma-plugin/utilities";
import { Logger } from "./logger";

// ============================================================================
// TYPES AND CONFIGURATION
// ============================================================================

/**
 * Circuit breaker state enum
 */
export enum CircuitBreakerState {
  CLOSED = "CLOSED",       // Normal operation
  OPEN = "OPEN",           // Breaker tripped, blocking requests
  HALF_OPEN = "HALF_OPEN", // Testing recovery after cooldown
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures within window to trip the breaker */
  failureThreshold: number;
  /** Time window in ms for counting failures (sliding window) */
  failureWindowMs: number;
  /** Cooldown period in ms before auto-reset */
  cooldownMs: number;
}

/**
 * Per-key breaker state
 */
interface BreakerData {
  /** Current state of the breaker */
  state: CircuitBreakerState;
  /** Timestamps of failures within the sliding window */
  failureTimestamps: number[];
  /** Time when the breaker was last tripped */
  lastTripTime: number | null;
}

// Default configuration per spec
const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  failureWindowMs: 5000,
  cooldownMs: 30000,
};

// ============================================================================
// CIRCUIT BREAKER CLASS
// ============================================================================

/**
 * Circuit breaker for per-operation failure protection
 * 
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 * 
 * // Before executing operation
 * if (breaker.isOpen("cb_INSERT_ANNOTATIONS")) {
 *   // Operation blocked, breaker is open
 *   return;
 * }
 * 
 * try {
 *   await performOperation();
 *   breaker.recordSuccess("cb_INSERT_ANNOTATIONS");
 * } catch (error) {
 *   breaker.recordFailure("cb_INSERT_ANNOTATIONS");
 *   throw error;
 * }
 * ```
 */
export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private readonly breakers: Map<string, BreakerData>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.breakers = new Map();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Get or create breaker data for a key
   */
  private getBreakerData(key: string): BreakerData {
    let data = this.breakers.get(key);
    if (!data) {
      data = {
        state: CircuitBreakerState.CLOSED,
        failureTimestamps: [],
        lastTripTime: null,
      };
      this.breakers.set(key, data);
    }
    return data;
  }

  /**
   * Prune failures older than the failure window
   */
  private pruneOldFailures(data: BreakerData, now: number): void {
    const cutoff = now - this.config.failureWindowMs;
    data.failureTimestamps = data.failureTimestamps.filter(ts => ts > cutoff);
  }

  /**
   * Check if cooldown has passed and transition to HALF_OPEN if so
   */
  private checkCooldown(data: BreakerData, key: string, now: number): void {
    if (
      data.state === CircuitBreakerState.OPEN &&
      data.lastTripTime !== null &&
      now - data.lastTripTime >= this.config.cooldownMs
    ) {
      data.state = CircuitBreakerState.HALF_OPEN;
      Logger.info("Circuit breaker", `Breaker ${key} moved to HALF_OPEN after cooldown`);
    }
  }

  /**
   * Trip the breaker to OPEN state
   */
  private tripBreaker(key: string, data: BreakerData, now: number): void {
    const previousState = data.state;
    data.state = CircuitBreakerState.OPEN;
    data.lastTripTime = now;

    Logger.warn("Circuit breaker", `Breaker ${key} TRIPPED`, {
      previousState,
      failureCount: data.failureTimestamps.length,
      cooldownMs: this.config.cooldownMs,
    });

    // Emit FIGMA_ERROR to UI
    const operation = key.replace(/^cb_/, "");
    const cooldownSeconds = Math.ceil(this.config.cooldownMs / 1000);
    
    emit("FIGMA_ERROR", {
      operation,
      reason: `Circuit breaker tripped: ${data.failureTimestamps.length} failures within ${this.config.failureWindowMs}ms`,
      cooldownMs: this.config.cooldownMs,
    });

    // CRITICAL: Show user-facing notification when breaker trips
    // This prevents "silent failure" where buttons stop working without explanation
    // Uses try-catch because figma global may not exist in test environment
    try {
      if (typeof figma !== "undefined" && figma.notify) {
        figma.notify(
          `⚠️ Canvas operations paused for ${cooldownSeconds}s due to repeated errors. Will auto-retry.`,
          { timeout: 5000 }
        );
      }
    } catch {
      // figma.notify not available (e.g., in tests)
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Record a failure for an operation
   * If threshold is reached within window, trips the breaker
   * 
   * @param key - Operation key (e.g., "cb_INSERT_ANNOTATIONS")
   */
  recordFailure(key: string): void {
    const now = Date.now();
    const data = this.getBreakerData(key);

    // If in HALF_OPEN and failure occurs, re-trip the breaker
    if (data.state === CircuitBreakerState.HALF_OPEN) {
      Logger.warn("Circuit breaker", `Breaker ${key} failed in HALF_OPEN state, re-tripping`);
      this.tripBreaker(key, data, now);
      return;
    }

    // Add failure timestamp
    data.failureTimestamps.push(now);

    // Prune old failures
    this.pruneOldFailures(data, now);

    Logger.debug("Circuit breaker", `Recorded failure for ${key}`, {
      failureCount: data.failureTimestamps.length,
      threshold: this.config.failureThreshold,
    });

    // Check if threshold reached
    if (data.failureTimestamps.length >= this.config.failureThreshold) {
      this.tripBreaker(key, data, now);
    }
  }

  /**
   * Record a success for an operation
   * Resets failure count and transitions from HALF_OPEN to CLOSED
   * 
   * @param key - Operation key (e.g., "cb_INSERT_ANNOTATIONS")
   */
  recordSuccess(key: string): void {
    const data = this.getBreakerData(key);
    const previousState = data.state;

    // Clear failures
    data.failureTimestamps = [];

    // If in HALF_OPEN, transition to CLOSED
    if (data.state === CircuitBreakerState.HALF_OPEN) {
      data.state = CircuitBreakerState.CLOSED;
      data.lastTripTime = null;

      Logger.info("Circuit breaker", `Breaker ${key} recovered to CLOSED`, {
        previousState,
      });

      // Emit FIGMA_ERROR_CLEARED to UI
      const operation = key.replace(/^cb_/, "");
      emit("FIGMA_ERROR_CLEARED", {
        operation,
      });
    } else if (previousState === CircuitBreakerState.CLOSED) {
      // Just clear failures in closed state
      Logger.debug("Circuit breaker", `Success recorded for ${key}, failures cleared`);
    }
  }

  /**
   * Check if the breaker is open (blocking requests)
   * Also handles auto-reset to HALF_OPEN after cooldown
   * 
   * @param key - Operation key (e.g., "cb_INSERT_ANNOTATIONS")
   * @returns true if breaker is OPEN, false if CLOSED or HALF_OPEN (allowing test request)
   */
  isOpen(key: string): boolean {
    const now = Date.now();
    const data = this.getBreakerData(key);

    // Check if cooldown has passed
    this.checkCooldown(data, key, now);

    // Only block if OPEN (HALF_OPEN allows one test request)
    return data.state === CircuitBreakerState.OPEN;
  }

  /**
   * Get time remaining until breaker resets (in ms)
   * Returns 0 if breaker is not open or cooldown has passed
   * 
   * @param key - Operation key (e.g., "cb_INSERT_ANNOTATIONS")
   * @returns Remaining cooldown time in ms, or 0 if no cooldown active
   */
  getTimeUntilReset(key: string): number {
    const data = this.breakers.get(key);
    if (!data || data.state !== CircuitBreakerState.OPEN || data.lastTripTime === null) {
      return 0;
    }

    const elapsed = Date.now() - data.lastTripTime;
    const remaining = this.config.cooldownMs - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Get current state of a breaker
   * 
   * @param key - Operation key (e.g., "cb_INSERT_ANNOTATIONS")
   * @returns Current circuit breaker state
   */
  getState(key: string): CircuitBreakerState {
    const now = Date.now();
    const data = this.getBreakerData(key);

    // Check if cooldown has passed
    this.checkCooldown(data, key, now);

    return data.state;
  }

  /**
   * Get all open breaker keys
   * Useful for UI to show which operations are currently blocked
   * 
   * @returns Array of operation keys with open breakers
   */
  getOpenBreakers(): string[] {
    const now = Date.now();
    const openKeys: string[] = [];

    this.breakers.forEach((data, key) => {
      // Check cooldown first
      this.checkCooldown(data, key, now);

      if (data.state === CircuitBreakerState.OPEN) {
        openKeys.push(key);
      }
    });

    return openKeys;
  }

  /**
   * Reset a specific breaker to CLOSED state
   * Mainly for testing purposes
   * 
   * @param key - Operation key to reset
   */
  reset(key: string): void {
    const data = this.breakers.get(key);
    if (data) {
      const previousState = data.state;
      data.state = CircuitBreakerState.CLOSED;
      data.failureTimestamps = [];
      data.lastTripTime = null;

      Logger.info("Circuit breaker", `Breaker ${key} manually reset`, {
        previousState,
      });

      // Emit cleared event if was open
      if (previousState !== CircuitBreakerState.CLOSED) {
        const operation = key.replace(/^cb_/, "");
        emit("FIGMA_ERROR_CLEARED", {
          operation,
        });
      }
    }
  }

  /**
   * Reset all breakers to CLOSED state
   * Mainly for testing purposes
   */
  resetAll(): void {
    const keys = Array.from(this.breakers.keys());
    keys.forEach(key => this.reset(key));
    Logger.info("Circuit breaker", "All breakers reset");
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global circuit breaker instance for canvas operations
 */
export const circuitBreaker = new CircuitBreaker();

// ============================================================================
// OPERATION KEY CONSTANTS
// ============================================================================

/**
 * Circuit breaker keys for canvas operations
 */
export const CircuitBreakerKeys = {
  INSERT_ANNOTATIONS: "cb_INSERT_ANNOTATIONS",
  UPDATE_ANNOTATIONS: "cb_UPDATE_ANNOTATIONS",
  SAVE_DATA: "cb_save-data",
  DELETE_DATA: "cb_delete-data",
} as const;

export type CircuitBreakerKey = typeof CircuitBreakerKeys[keyof typeof CircuitBreakerKeys];
