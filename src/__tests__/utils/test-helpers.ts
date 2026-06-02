// ============================================================================
// TEST HELPERS - Common test utilities
// ============================================================================

import { expect } from "vitest";
import type { Annotation } from "../../types";

/**
 * Deep clone an object (for creating isolated test data)
 */
export function deepClone<T>(obj: T): T {
  // JSON.parse returns unknown when casting; cast via unknown -> T to satisfy no-unsafe-return
  return JSON.parse(JSON.stringify(obj)) as unknown as T;
}

/**
 * Wait for a specified number of milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that two annotations are equal (excluding timestamps)
 */
export function assertAnnotationsEqualIgnoringTimestamps(
  actual: Annotation,
  expected: Annotation
): void {
  const { createdAt: _ac, updatedAt: _au, ...actualWithoutTimestamps } = actual;
  const { createdAt: _ec, updatedAt: _eu, ...expectedWithoutTimestamps } = expected;
  
  expect(actualWithoutTimestamps).toEqual(expectedWithoutTimestamps);
}

/**
 * Create a timestamp in the past
 */
export function timestampInPast(hoursAgo: number): number {
  return Date.now() - (hoursAgo * 60 * 60 * 1000);
}

/**
 * Create a timestamp in the future
 */
export function timestampInFuture(hoursFromNow: number): number {
  return Date.now() + (hoursFromNow * 60 * 60 * 1000);
}

/**
 * Mock console methods for testing Logger output
 */
export function mockConsole(): {
  logs: string[];
  warns: string[];
  errors: string[];
  restore: () => void;
} {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];
  
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.warn = (...args: unknown[]) => {
    warns.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
  
  return {
    logs,
    warns,
    errors,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}
