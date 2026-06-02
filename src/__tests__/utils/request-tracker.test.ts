import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  trackRequest,
  completeRequest,
  isStaleResponse,
  isDuplicateRequest,
  markRequestProcessed,
  cleanupExpiredRequests,
  startCleanupInterval,
  stopCleanupInterval,
  resetRequestTracker,
  inFlightRequests,
  processedRequestIds,
} from '../../utils/request-tracker'
import type { InFlightRequest } from '../../utils/request-tracker'
import { createMobileAnnotation } from "../fixtures/annotations";

describe("request-tracker", () => {
  beforeEach(() => {
    resetRequestTracker();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("trackRequest", () => {
    it("should add entry to inFlightRequests with timestamp", () => {
      const request: InFlightRequest = {
        requestId: "test-request-1",
        operationType: "CREATE",
        timestamp: Date.now(),
        preMutationSnapshot: [],
      };

      trackRequest(request);

      expect(inFlightRequests.has("test-request-1")).toBe(true);
      expect(inFlightRequests.get("test-request-1")).toEqual(request);
    });
  });

  describe("completeRequest", () => {
    it("should return snapshot and remove entry", () => {
      const request: InFlightRequest = {
        requestId: "test-request-1",
        operationType: "UPDATE",
        timestamp: Date.now(),
        preMutationSnapshot: [createMobileAnnotation({ id: 1 })],
      };

      trackRequest(request);
      expect(inFlightRequests.has("test-request-1")).toBe(true);

      const completed = completeRequest("test-request-1");

      expect(completed).toEqual(request);
      expect(inFlightRequests.has("test-request-1")).toBe(false);
    });

    it("should return undefined for unknown requestId", () => {
      const completed = completeRequest("unknown-request");
      expect(completed).toBeUndefined();
    });
  });

  describe("isStaleResponse", () => {
    it("should return true for unknown requestId", () => {
      expect(isStaleResponse("unknown-request")).toBe(true);
    });

    it("should return true for undefined requestId", () => {
      expect(isStaleResponse(undefined)).toBe(true);
    });

    it("should return false for valid requestId", () => {
      const request: InFlightRequest = {
        requestId: "test-request-1",
        operationType: "CREATE",
        timestamp: Date.now(),
        preMutationSnapshot: [],
      };

      trackRequest(request);
      expect(isStaleResponse("test-request-1")).toBe(false);
    });

    it("should return true for expired request (older than 30s)", () => {
      const request: InFlightRequest = {
        requestId: "test-request-1",
        operationType: "CREATE",
        timestamp: Date.now() - 31000, // 31 seconds ago
        preMutationSnapshot: [],
      };

      trackRequest(request);
      expect(isStaleResponse("test-request-1")).toBe(true);
      // Should also remove expired entry
      expect(inFlightRequests.has("test-request-1")).toBe(false);
    });
  });

  describe("isDuplicateRequest", () => {
    it("should return false for unknown requestId", () => {
      expect(isDuplicateRequest("unknown-request")).toBe(false);
    });

    it("should return false for undefined requestId (backwards compatibility)", () => {
      expect(isDuplicateRequest(undefined)).toBe(false);
    });

    it("should return true for processed requestId", () => {
      markRequestProcessed("test-request-1");
      expect(isDuplicateRequest("test-request-1")).toBe(true);
    });
  });

  describe("markRequestProcessed", () => {
    it("should add requestId to processedRequestIds", () => {
      markRequestProcessed("test-request-1");
      expect(processedRequestIds.has("test-request-1")).toBe(true);
    });

    it("should ignore undefined requestId", () => {
      const beforeSize = processedRequestIds.size;
      markRequestProcessed(undefined);
      expect(processedRequestIds.size).toBe(beforeSize);
    });
  });

  describe("cleanupExpiredRequests", () => {
    it("should remove entries older than 30 seconds", () => {
      const oldRequest: InFlightRequest = {
        requestId: "old-request",
        operationType: "CREATE",
        timestamp: Date.now() - 31000, // 31 seconds ago
        preMutationSnapshot: [],
      };

      const newRequest: InFlightRequest = {
        requestId: "new-request",
        operationType: "UPDATE",
        timestamp: Date.now() - 1000, // 1 second ago
        preMutationSnapshot: [],
      };

      trackRequest(oldRequest);
      trackRequest(newRequest);

      expect(inFlightRequests.size).toBe(2);

      cleanupExpiredRequests();

      expect(inFlightRequests.has("old-request")).toBe(false);
      expect(inFlightRequests.has("new-request")).toBe(true);
      expect(inFlightRequests.size).toBe(1);
    });

    it("should not remove entries newer than 30 seconds", () => {
      const request: InFlightRequest = {
        requestId: "new-request",
        operationType: "CREATE",
        timestamp: Date.now() - 1000, // 1 second ago
        preMutationSnapshot: [],
      };

      trackRequest(request);
      cleanupExpiredRequests();

      expect(inFlightRequests.has("new-request")).toBe(true);
    });
  });

  describe("deduplication TTL", () => {
    it("should remove processed requestId after 5 seconds", async () => {
      markRequestProcessed("test-request-1");
      expect(processedRequestIds.has("test-request-1")).toBe(true);

      // Advance time by 5 seconds
      vi.advanceTimersByTime(5000);

      // Wait for setTimeout to execute
      await vi.runAllTimersAsync();

      expect(processedRequestIds.has("test-request-1")).toBe(false);
    });
  });

  describe("cleanup interval", () => {
    it("should start cleanup interval", () => {
      // Verify starting and stopping the interval doesn't throw
      expect(() => startCleanupInterval()).not.toThrow();
      expect(() => stopCleanupInterval()).not.toThrow();
      // Should be able to start again without error
      expect(() => startCleanupInterval()).not.toThrow();
      stopCleanupInterval();
    });

    it("should not start multiple intervals", () => {
      // Verify idempotent behavior - calling start multiple times doesn't throw
      expect(() => {
        startCleanupInterval();
        startCleanupInterval(); // Should be idempotent
        stopCleanupInterval();
      }).not.toThrow();
    });
  });

  describe("resetRequestTracker", () => {
    it("should clear all tracking state", () => {
      trackRequest({
        requestId: "test-1",
        operationType: "CREATE",
        timestamp: Date.now(),
        preMutationSnapshot: [],
      });
      markRequestProcessed("test-2");
      startCleanupInterval();

      resetRequestTracker();

      expect(inFlightRequests.size).toBe(0);
      expect(processedRequestIds.size).toBe(0);
      // Cleanup interval should be stopped
      stopCleanupInterval(); // Should not error
    });
  });
});

