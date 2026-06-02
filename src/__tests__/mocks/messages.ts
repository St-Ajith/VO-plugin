// ============================================================================
// MESSAGE MOCK UTILITIES - Test utilities for message passing
// ============================================================================

import { vi } from "vitest";

/**
 * Captured message for verification
 */
interface CapturedMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

/**
 * Message handler type
 */
type MessageHandler = (payload: unknown) => void;

/**
 * createMockMessageSystem - Factory for creating isolated message mock instances
 * Mocks the @create-figma-plugin/utilities emit/on system
 */
export function createMockMessageSystem() {
  const emittedMessages: CapturedMessage[] = [];
  const handlers = new Map<string, MessageHandler[]>();

  /**
   * Mock emit function
   * Captures all emitted messages and calls registered handlers
   */
  const mockEmit = vi.fn((type: string, payload?: unknown) => {
    emittedMessages.push({
      type,
      payload,
      timestamp: Date.now(),
    });

    // Call registered handlers
    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => handler(payload));
    }
  });

  /**
   * Mock on function
   * Registers message handlers
   */
  const mockOn = vi.fn((type: string, handler: MessageHandler) => {
    if (!handlers.has(type)) {
      handlers.set(type, []);
    }
    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      typeHandlers.push(handler);
    }
    
    // Return cleanup function
    return () => {
      const cleanupHandlers = handlers.get(type);
      if (cleanupHandlers) {
        const index = cleanupHandlers.indexOf(handler);
        if (index > -1) {
          cleanupHandlers.splice(index, 1);
        }
      }
    };
  });

  /**
   * Test utilities
   */
  return {
    emit: mockEmit,
    on: mockOn,

    // Message inspection
    getEmittedMessages: () => [...emittedMessages],
    
    getMessagesByType: (type: string) => {
      return emittedMessages.filter((m) => m.type === type);
    },
    
    wasMessageEmitted: (type: string) => {
      return emittedMessages.some((m) => m.type === type);
    },
    
    getLastMessage: () => {
      return emittedMessages[emittedMessages.length - 1];
    },
    
    getLastMessageByType: (type: string) => {
      const messages = emittedMessages.filter((m) => m.type === type);
      return messages[messages.length - 1];
    },

    // Handler inspection
    getHandlerCount: (type: string) => {
      return handlers.get(type)?.length ?? 0;
    },

    // Simulate incoming message
    simulateMessage: (type: string, payload?: unknown) => {
      const typeHandlers = handlers.get(type);
      if (typeHandlers) {
        typeHandlers.forEach((handler) => handler(payload));
      }
    },

    // Clear for test isolation
    clearMessages: () => {
      emittedMessages.length = 0;
    },
    
    clearHandlers: () => {
      handlers.clear();
    },
    
    reset: () => {
      emittedMessages.length = 0;
      handlers.clear();
      vi.clearAllMocks();
    },
  };
}

/**
 * Type alias for the mock instance
 */
export type MockMessageSystemInstance = ReturnType<typeof createMockMessageSystem>;

/**
 * createMessageRoundTripHelper - Helper to simulate full message round-trips
 * Useful for testing request/response patterns
 */
export function createMessageRoundTripHelper(
  messageSystem: MockMessageSystemInstance
) {
  return {
    /**
     * Send a message and wait for a response
     */
    async sendAndWaitForResponse<TRequest, TResponse>(
      requestType: string,
      requestPayload: TRequest,
      responseType: string,
      timeoutMs = 1000
    ): Promise<TResponse> {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line prefer-const -- cleanup is reassigned in the callback
        let cleanup: (() => void) | undefined;
        const timeout = setTimeout(() => {
          cleanup?.();
          reject(new Error(`Timeout waiting for ${responseType}`));
        }, timeoutMs);

        // Register one-time response handler
        cleanup = messageSystem.on(responseType, (payload) => {
          clearTimeout(timeout);
          cleanup?.();
          resolve(payload as TResponse);
        });

        // Send the request
        messageSystem.emit(requestType, requestPayload);
      });
    },

    /**
     * Verify a message was sent in response to another message
     */
    verifyMessageSequence(
      triggerType: string,
      expectedResponseType: string
    ): boolean {
      const messages = messageSystem.getEmittedMessages();
      const triggerIndex = messages.findIndex((m) => m.type === triggerType);
      if (triggerIndex === -1) return false;

      const responseIndex = messages.findIndex(
        (m, i) => i > triggerIndex && m.type === expectedResponseType
      );
      return responseIndex > triggerIndex;
    },
  };
}
