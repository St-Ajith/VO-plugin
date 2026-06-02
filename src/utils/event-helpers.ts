// ============================================================================
// EVENT VALIDATION UTILITIES - Type-safe event handling
// ============================================================================

import { emit, on } from "@create-figma-plugin/utilities";
import { Logger } from "./logger";
import { PluginActionMessages, NodeChangeMessages } from "../types";

// Simple async operation wrapper with error logging
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  context: { operation?: string; component?: string },
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    Logger.error(
      context.component || "Plugin",
      `Error in ${context.operation || "operation"}`,
      error
    );
    return fallbackValue;
  }
}

// Validate event data structure at runtime
export function validateEventData<T>(
  eventType: string,
  data: T,
  schema: Record<string, string>
): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  for (const [key, expectedType] of Object.entries(schema)) {
    const value = (data as Record<string, unknown>)[key];

    if (value === undefined) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    const actualType = Array.isArray(value) ? "array" : typeof value;

    // Handle union types like "string | null"
    if (expectedType.includes(" | ")) {
      const allowedTypes = expectedType.split(" | ").map((t) => t.trim());
      const isValidType = allowedTypes.some((type) => {
        if (type === "null") return value === null;
        return actualType === type;
      });
      if (!isValidType) {
        errors.push(
          `Field ${key}: expected ${expectedType}, got ${actualType}`
        );
      }
    } else {
      // Simple type check
      if (actualType !== expectedType) {
        errors.push(
          `Field ${key}: expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    ...(errors.length > 0 && { errors }),
  };
}

// Enhanced emit with validation (generic version)
export async function emitValidated<T>(
  eventType: string,
  data: T,
  schema?: Record<string, string>
): Promise<boolean> {
  return (
    (await safeAsyncOperation(
      () => {
        // Validate data structure if schema provided
        if (schema) {
          const validation = validateEventData(eventType, data, schema);
          if (!validation.isValid) {
            Logger.error(
              "event-system",
              `Invalid data for ${eventType}: ${validation.errors?.join(", ")}`,
              { eventType, validationErrors: validation.errors }
            );
            return Promise.resolve(false);
          }
        }

        // Type assertion needed because emit expects specific event types, but we're using a generic function
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emit(eventType as keyof (PluginActionMessages & NodeChangeMessages), data as any);
        Logger.debug("Event emit", `Successfully emitted ${eventType}`);
        return Promise.resolve(true);
      },
      {
        operation: "emit",
        component: "event-system",
      },
      false
    )) ?? false
  );
}

// Enhanced on with error handling
export function onValidated<T extends keyof PluginActionMessages>(
  eventType: T,
  handler: (data: PluginActionMessages[T]) => void | Promise<void>
): (() => void) | null {
  try {
    const wrappedHandler = (data: PluginActionMessages[T]) => {
      void (async () => {
        await safeAsyncOperation(
          async () => {
            Logger.debug("Event handler", `Received ${eventType}`);
            await handler(data);
          },
          {
            operation: "event-handler",
            component: "event-system",
          }
        );
      })();
    };

    return on(eventType, wrappedHandler);
  } catch (error) {
    Logger.error(
      "event-system",
      `Error setting up event handler for ${eventType}`,
      error
    );
    return null;
  }
}

