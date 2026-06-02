// ============================================================================
// Generate Request ID Utility
// ============================================================================
// Generates unique request IDs for CRUD operation tracking.
// Uses crypto.randomUUID when available, falls back to timestamp-based ID
// for environments where Web Crypto API is unavailable (e.g., Figma iframe).
// ============================================================================

/* eslint-disable no-restricted-properties -- This is the canonical wrapper for crypto.randomUUID */

/**
 * Generates a unique request ID for tracking CRUD operations.
 * 
 * Uses crypto.randomUUID() when available (standard UUID v4).
 * Falls back to timestamp + random hex for environments where
 * Web Crypto API is unavailable (like Figma's sandboxed iframe).
 * 
 * @returns A unique string identifier (UUID v4 or fallback format)
 * @example
 * const requestId = generateRequestId()
 * // Returns: "550e8400-e29b-41d4-a716-446655440000" (crypto available)
 * // Or: "req-1701792000000-a1b2c3d4e5f6" (fallback)
 */
export function generateRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch (_error) {
    // Fallback to non-crypto ID
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
