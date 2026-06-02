// ============================================================================
// REQUEST TRACKER - Track in-flight requests and prevent duplicate execution
// ============================================================================
// Shared utility for SA-02 (request tracking) and SA-03 (state recovery)
// ============================================================================

import type { Annotation } from "../types";
import { Logger } from "./logger";

export interface InFlightRequest {
  requestId: string;
  operationType: "CREATE" | "UPDATE" | "DELETE" | "REORDER";
  timestamp: number;
  preMutationSnapshot: Annotation[] | null; // Captured before optimistic update
}

// Pending requests awaiting response (UI thread)
export const inFlightRequests = new Map<string, InFlightRequest>();

// Processed request IDs (for deduplication on Main thread)
// TTL: 5 seconds (long enough for slow operations, short enough to prevent memory bloat)
export const processedRequestIds = new Set<string>();

// Cleanup interval for expired requests (30 seconds)
const CLEANUP_INTERVAL_MS = 30000;
const DEDUPLICATION_TTL_MS = 5000;

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Track a new in-flight request
 * Called by UI before emitting state-mutating operations
 */
export function trackRequest(request: InFlightRequest): void {
  inFlightRequests.set(request.requestId, request);
  Logger.debug("Request tracker", "Tracking request", {
    requestId: request.requestId,
    operationType: request.operationType,
  });
}

/**
 * Complete a request and return its snapshot
 * Called by UI when receiving a valid response
 */
export function completeRequest(
  requestId: string
): InFlightRequest | undefined {
  const request = inFlightRequests.get(requestId);
  if (request) {
    inFlightRequests.delete(requestId);
    Logger.debug("Request tracker", "Completed request", {
      requestId,
      operationType: request.operationType,
    });
  }
  return request;
}

/**
 * Check if a response is stale (requestId unknown or expired)
 * Called by UI when receiving responses
 */
export function isStaleResponse(requestId: string | undefined): boolean {
  if (!requestId) {
    // No requestId means it's an old message format - consider it stale
    return true;
  }

  const request = inFlightRequests.get(requestId);
  if (!request) {
    // Request not found - either expired or never tracked
    return true;
  }

  // Check if request has expired (30 seconds)
  const age = Date.now() - request.timestamp;
  if (age > CLEANUP_INTERVAL_MS) {
    Logger.warn("Request tracker", "Stale response detected (expired)", {
      requestId,
      age,
    });
    inFlightRequests.delete(requestId);
    return true;
  }

  return false;
}

/**
 * Check if a requestId has already been processed (for deduplication)
 * Called by Main thread before processing
 */
export function isDuplicateRequest(requestId: string | undefined): boolean {
  if (!requestId) {
    // No requestId - allow through (backwards compatibility)
    return false;
  }

  return processedRequestIds.has(requestId);
}

/**
 * Mark a requestId as processed (for deduplication)
 * Called by Main thread after processing
 */
export function markRequestProcessed(requestId: string | undefined): void {
  if (!requestId) {
    return;
  }

  processedRequestIds.add(requestId);
  Logger.debug("Request tracker", "Marked request as processed", { requestId });

  // Schedule cleanup after TTL
  setTimeout(() => {
    processedRequestIds.delete(requestId);
    Logger.debug("Request tracker", "Cleaned up processed requestId", {
      requestId,
    });
  }, DEDUPLICATION_TTL_MS);
}

/**
 * Cleanup expired in-flight requests
 * Removes entries older than 30 seconds
 */
export function cleanupExpiredRequests(): void {
  const now = Date.now();
  let cleanedCount = 0;

  const requestIdsToDelete: string[] = [];
  inFlightRequests.forEach((request, requestId) => {
    const age = now - request.timestamp;
    if (age > CLEANUP_INTERVAL_MS) {
      requestIdsToDelete.push(requestId);
    }
  });

  for (const requestId of requestIdsToDelete) {
    const request = inFlightRequests.get(requestId);
    if (request) {
      inFlightRequests.delete(requestId);
      cleanedCount++;
      Logger.debug("Request tracker", "Cleaned up expired request", {
        requestId,
        operationType: request.operationType,
        age: now - request.timestamp,
      });
    }
  }

  if (cleanedCount > 0) {
    Logger.info("Request tracker", "Cleaned up expired requests", {
      count: cleanedCount,
    });
  }
}

/**
 * Start periodic cleanup of expired requests
 * Should be called once on plugin initialization
 */
export function startCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    // Already started
    return;
  }

  cleanupIntervalId = setInterval(() => {
    cleanupExpiredRequests();
  }, CLEANUP_INTERVAL_MS);

  Logger.debug("Request tracker", "Started cleanup interval", {
    intervalMs: CLEANUP_INTERVAL_MS,
  });
}

/**
 * Stop periodic cleanup
 * Useful for testing or plugin shutdown
 */
export function stopCleanupInterval(): void {
  if (cleanupIntervalId !== null) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    Logger.debug("Request tracker", "Stopped cleanup interval");
  }
}

/**
 * Reset all tracking state (useful for testing)
 */
export function resetRequestTracker(): void {
  inFlightRequests.clear();
  processedRequestIds.clear();
  stopCleanupInterval();
  Logger.debug("Request tracker", "Reset all tracking state");
}
