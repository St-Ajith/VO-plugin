import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from "vitest";
import { 
  CircuitBreaker, 
  CircuitBreakerState, 
  CircuitBreakerKeys,
  circuitBreaker 
} from "../../utils/circuit-breaker";
import { emit } from "@create-figma-plugin/utilities";

// Mock the emit function
vi.mock("@create-figma-plugin/utilities", () => ({
  emit: vi.fn(),
}));

// Get typed mock reference - cast to Mock to satisfy ESLint
const mockEmit = emit as unknown as Mock;

// Mock the Logger
vi.mock("../../utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    // Create a fresh instance for each test
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      failureWindowMs: 5000,
      cooldownMs: 30000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Foundation (Task 1.x)", () => {
    it("1.2 should initialize with CLOSED state", () => {
      expect(breaker.getState("test_key")).toBe(CircuitBreakerState.CLOSED);
    });

    it("1.3 should maintain independent instances per key", () => {
      // Record failures for key1
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");

      // key1 should be open, key2 should still be closed
      expect(breaker.isOpen("key1")).toBe(true);
      expect(breaker.isOpen("key2")).toBe(false);
    });

    it("1.4 should use default configuration values", () => {
      const defaultBreaker = new CircuitBreaker();
      // Verify by behavior: 3 failures should trip
      defaultBreaker.recordFailure("test");
      defaultBreaker.recordFailure("test");
      expect(defaultBreaker.isOpen("test")).toBe(false);
      defaultBreaker.recordFailure("test");
      expect(defaultBreaker.isOpen("test")).toBe(true);
    });
  });

  describe("Circuit Breaker Logic (Task 2.x)", () => {
    it("2.1 recordFailure should increment failure count and check threshold", () => {
      const key = "cb_INSERT_ANNOTATIONS";
      
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(false);
      
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(false);
      
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(true);
    });

    it("2.2 recordSuccess should reset failure count", () => {
      const key = "test_key";
      
      // Record 2 failures (just under threshold)
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      // Record success
      breaker.recordSuccess(key);
      
      // Now 2 more failures should not trip (only 2 total after reset)
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(false);
      
      // Third failure should trip
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(true);
    });

    it("2.3 isOpen should return true when breaker is tripped", () => {
      const key = "test_key";
      
      expect(breaker.isOpen(key)).toBe(false);
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      expect(breaker.isOpen(key)).toBe(true);
    });

    it("2.4 getTimeUntilReset should return remaining cooldown ms", () => {
      const key = "test_key";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      // Should have ~30000ms cooldown
      const timeUntilReset = breaker.getTimeUntilReset(key);
      expect(timeUntilReset).toBeGreaterThan(29000);
      expect(timeUntilReset).toBeLessThanOrEqual(30000);
      
      // Advance time by 10 seconds
      vi.advanceTimersByTime(10000);
      
      // Should have ~20000ms remaining
      const timeAfter10s = breaker.getTimeUntilReset(key);
      expect(timeAfter10s).toBeGreaterThan(19000);
      expect(timeAfter10s).toBeLessThanOrEqual(20000);
    });

    it("2.5 should auto-reset after cooldown period", () => {
      const key = "test_key";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(true);
      
      // Advance time past cooldown
      vi.advanceTimersByTime(30001);
      
      // Should now be in HALF_OPEN state (allows test request)
      expect(breaker.isOpen(key)).toBe(false);
      expect(breaker.getState(key)).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe("State Management (Task 3.x)", () => {
    it("3.1 should store failure timestamps in sliding window", () => {
      const key = "test_key";
      
      // Record failures at different times
      breaker.recordFailure(key);
      vi.advanceTimersByTime(1000);
      breaker.recordFailure(key);
      vi.advanceTimersByTime(1000);
      
      // Only 2 failures in window, should not trip
      expect(breaker.isOpen(key)).toBe(false);
      
      // Add third failure
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(true);
    });

    it("3.2 should remove failures older than failureWindowMs", () => {
      const key = "test_key";
      
      // Record 2 failures
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      // Advance time past window
      vi.advanceTimersByTime(6000);
      
      // Old failures should be pruned, new failure alone won't trip
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(false);
    });

    it("3.3 should track lastTripTime for cooldown calculation", () => {
      const key = "test_key";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      const initialTimeRemaining = breaker.getTimeUntilReset(key);
      
      // Advance time
      vi.advanceTimersByTime(15000);
      
      const laterTimeRemaining = breaker.getTimeUntilReset(key);
      expect(laterTimeRemaining).toBeLessThan(initialTimeRemaining);
      expect(initialTimeRemaining - laterTimeRemaining).toBeCloseTo(15000, -2);
    });

    it("3.4 should implement HALF_OPEN state for testing recovery", () => {
      const key = "test_key";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      expect(breaker.getState(key)).toBe(CircuitBreakerState.OPEN);
      
      // Advance past cooldown
      vi.advanceTimersByTime(30001);
      
      // Check state - should transition to HALF_OPEN
      expect(breaker.getState(key)).toBe(CircuitBreakerState.HALF_OPEN);
      expect(breaker.isOpen(key)).toBe(false); // Allows test request
      
      // Success should transition to CLOSED
      breaker.recordSuccess(key);
      expect(breaker.getState(key)).toBe(CircuitBreakerState.CLOSED);
    });

    it("3.4 HALF_OPEN failure should re-trip breaker", () => {
      const key = "test_key";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      // Advance past cooldown
      vi.advanceTimersByTime(30001);
      expect(breaker.getState(key)).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Failure in HALF_OPEN should re-trip immediately
      breaker.recordFailure(key);
      expect(breaker.getState(key)).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe("Scenario Tests (from spec)", () => {
    it("3 failures within 5s trips breaker", () => {
      const key = "test_key";
      
      breaker.recordFailure(key);
      vi.advanceTimersByTime(1000);
      breaker.recordFailure(key);
      vi.advanceTimersByTime(1000);
      breaker.recordFailure(key);
      
      expect(breaker.isOpen(key)).toBe(true);
    });

    it("failures outside window don't trip breaker", () => {
      const key = "test_key";
      
      // 2 failures, then wait for window to expire
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      vi.advanceTimersByTime(6000); // Past 5s window
      
      // 1 more failure - old ones should be pruned
      breaker.recordFailure(key);
      
      expect(breaker.isOpen(key)).toBe(false);
    });

    it("success resets failure count", () => {
      const key = "test_key";
      
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordSuccess(key);
      
      // Need 3 new failures to trip
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(false);
    });

    it("breaker auto-resets after cooldown", () => {
      const key = "test_key";
      
      // Trip
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      expect(breaker.isOpen(key)).toBe(true);
      
      // Wait for cooldown
      vi.advanceTimersByTime(30001);
      
      // Should be HALF_OPEN (isOpen returns false)
      expect(breaker.isOpen(key)).toBe(false);
    });

    it("different operations have independent breakers", () => {
      // Trip INSERT
      breaker.recordFailure(CircuitBreakerKeys.INSERT_ANNOTATIONS);
      breaker.recordFailure(CircuitBreakerKeys.INSERT_ANNOTATIONS);
      breaker.recordFailure(CircuitBreakerKeys.INSERT_ANNOTATIONS);
      
      // INSERT is open, UPDATE is not
      expect(breaker.isOpen(CircuitBreakerKeys.INSERT_ANNOTATIONS)).toBe(true);
      expect(breaker.isOpen(CircuitBreakerKeys.UPDATE_ANNOTATIONS)).toBe(false);
    });

    it("old failures don't count (sliding window)", () => {
      const key = "test_key";
      
      // 2 failures 10 seconds ago
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      vi.advanceTimersByTime(10000);
      
      // 1 failure now
      breaker.recordFailure(key);
      
      // Only 1 failure in window (threshold is 3)
      expect(breaker.isOpen(key)).toBe(false);
    });

    it("rapid failures trip breaker immediately", () => {
      const key = "test_key";
      
      // 3 failures within 2 seconds
      breaker.recordFailure(key);
      vi.advanceTimersByTime(500);
      breaker.recordFailure(key);
      vi.advanceTimersByTime(500);
      breaker.recordFailure(key);
      
      expect(breaker.isOpen(key)).toBe(true);
    });
  });

  describe("Utility Methods", () => {
    it("getOpenBreakers should return all open breaker keys", () => {
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      
      breaker.recordFailure("key2");
      breaker.recordFailure("key2");
      breaker.recordFailure("key2");
      
      const openBreakers = breaker.getOpenBreakers();
      expect(openBreakers).toContain("key1");
      expect(openBreakers).toContain("key2");
      expect(openBreakers).toHaveLength(2);
    });

    it("reset should reset a specific breaker", () => {
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      expect(breaker.isOpen("key1")).toBe(true);
      
      breaker.reset("key1");
      expect(breaker.isOpen("key1")).toBe(false);
      expect(breaker.getState("key1")).toBe(CircuitBreakerState.CLOSED);
    });

    it("resetAll should reset all breakers", () => {
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      breaker.recordFailure("key1");
      
      breaker.recordFailure("key2");
      breaker.recordFailure("key2");
      breaker.recordFailure("key2");
      
      breaker.resetAll();
      
      expect(breaker.isOpen("key1")).toBe(false);
      expect(breaker.isOpen("key2")).toBe(false);
    });
  });

  describe("FIGMA_ERROR Emission (Task 5.x)", () => {
    it("5.2 should emit FIGMA_ERROR when breaker trips", () => {
      const key = "cb_INSERT_ANNOTATIONS";
      
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      expect(mockEmit).toHaveBeenCalledWith("FIGMA_ERROR", {
        operation: "INSERT_ANNOTATIONS",
        reason: expect.stringContaining("Circuit breaker tripped"),
        cooldownMs: 30000,
      });
    });

    it("5.3 should emit FIGMA_ERROR_CLEARED when breaker resets", () => {
      const key = "cb_UPDATE_ANNOTATIONS";
      
      // Trip the breaker
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      breaker.recordFailure(key);
      
      vi.clearAllMocks();
      
      // Wait for cooldown and record success
      vi.advanceTimersByTime(30001);
      breaker.getState(key); // Trigger HALF_OPEN transition
      breaker.recordSuccess(key);
      
      expect(mockEmit).toHaveBeenCalledWith("FIGMA_ERROR_CLEARED", {
        operation: "UPDATE_ANNOTATIONS",
      });
    });
  });

  describe("CircuitBreakerKeys constants", () => {
    it("should have correct key format", () => {
      expect(CircuitBreakerKeys.INSERT_ANNOTATIONS).toBe("cb_INSERT_ANNOTATIONS");
      expect(CircuitBreakerKeys.UPDATE_ANNOTATIONS).toBe("cb_UPDATE_ANNOTATIONS");
      expect(CircuitBreakerKeys.SAVE_DATA).toBe("cb_save-data");
      expect(CircuitBreakerKeys.DELETE_DATA).toBe("cb_delete-data");
    });
  });

  describe("Singleton instance", () => {
    it("should export a global circuit breaker instance", () => {
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
    });
  });
});
