// ============================================================================
// MESSAGE MOCK UTILITIES INTEGRATION TESTS
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createMockMessageSystem,
  createMessageRoundTripHelper,
} from "../mocks/messages";

describe("Message Mock Utilities Integration Tests", () => {
  let messageSystem: ReturnType<typeof createMockMessageSystem>;

  beforeEach(() => {
    messageSystem = createMockMessageSystem();
  });

  afterEach(() => {
    messageSystem.reset();
  });

  describe("emit and message capture", () => {
    it("should capture emitted messages", () => {
      // Act
      messageSystem.emit("TEST_EVENT", { data: "test" });
      messageSystem.emit("ANOTHER_EVENT", { value: 123 });

      // Assert
      const messages = messageSystem.getEmittedMessages();
      expect(messages).toHaveLength(2);
      const firstMessage = messages[0];
      const secondMessage = messages[1];
      expect(firstMessage).toBeDefined();
      expect(secondMessage).toBeDefined();
      expect(firstMessage?.type).toBe("TEST_EVENT");
      expect(firstMessage?.payload).toEqual({ data: "test" });
      expect(secondMessage?.type).toBe("ANOTHER_EVENT");
      expect(secondMessage?.payload).toEqual({ value: 123 });
    });

    it("should get messages by type", () => {
      // Act
      messageSystem.emit("EVENT_A", { id: 1 });
      messageSystem.emit("EVENT_B", { id: 2 });
      messageSystem.emit("EVENT_A", { id: 3 });

      // Assert
      const eventAMessages = messageSystem.getMessagesByType("EVENT_A");
      expect(eventAMessages).toHaveLength(2);
      const firstEventA = eventAMessages[0];
      const secondEventA = eventAMessages[1];
      expect(firstEventA).toBeDefined();
      expect(secondEventA).toBeDefined();
      expect(firstEventA?.payload).toEqual({ id: 1 });
      expect(secondEventA?.payload).toEqual({ id: 3 });
    });

    it("should check if message was emitted", () => {
      // Act
      messageSystem.emit("EMITTED_EVENT", {});

      // Assert
      expect(messageSystem.wasMessageEmitted("EMITTED_EVENT")).toBe(true);
      expect(messageSystem.wasMessageEmitted("NOT_EMITTED")).toBe(false);
    });

    it("should get last message", () => {
      // Act
      messageSystem.emit("EVENT_1", { value: 1 });
      messageSystem.emit("EVENT_2", { value: 2 });
      messageSystem.emit("EVENT_3", { value: 3 });

      // Assert
      const lastMessage = messageSystem.getLastMessage();
      expect(lastMessage).toBeDefined();
      expect(lastMessage?.type).toBe("EVENT_3");
      expect(lastMessage?.payload).toEqual({ value: 3 });
    });

    it("should get last message by type", () => {
      // Act
      messageSystem.emit("TYPE_A", { value: 1 });
      messageSystem.emit("TYPE_B", { value: 2 });
      messageSystem.emit("TYPE_A", { value: 3 });

      // Assert
      const lastTypeA = messageSystem.getLastMessageByType("TYPE_A");
      expect(lastTypeA).toBeDefined();
      expect(lastTypeA?.payload).toEqual({ value: 3 });
    });
  });

  describe("on and handler registration", () => {
    it("should call registered handlers when message is emitted", () => {
      // Arrange
      const receivedPayloads: unknown[] = [];
      messageSystem.on("TEST_EVENT", (payload) => {
        receivedPayloads.push(payload);
      });

      // Act
      messageSystem.emit("TEST_EVENT", { data: "test1" });
      messageSystem.emit("TEST_EVENT", { data: "test2" });

      // Assert
      expect(receivedPayloads).toHaveLength(2);
      expect(receivedPayloads[0]).toEqual({ data: "test1" });
      expect(receivedPayloads[1]).toEqual({ data: "test2" });
    });

    it("should support multiple handlers for same event", () => {
      // Arrange
      const handler1Calls: unknown[] = [];
      const handler2Calls: unknown[] = [];

      messageSystem.on("SHARED_EVENT", (payload) => {
        handler1Calls.push(payload);
      });
      messageSystem.on("SHARED_EVENT", (payload) => {
        handler2Calls.push(payload);
      });

      // Act
      messageSystem.emit("SHARED_EVENT", { value: 42 });

      // Assert
      expect(handler1Calls).toHaveLength(1);
      expect(handler2Calls).toHaveLength(1);
      expect(handler1Calls[0]).toEqual({ value: 42 });
      expect(handler2Calls[0]).toEqual({ value: 42 });
    });

    it("should return handler count", () => {
      // Act
      messageSystem.on("EVENT_A", () => {});
      messageSystem.on("EVENT_A", () => {});
      messageSystem.on("EVENT_B", () => {});

      // Assert
      expect(messageSystem.getHandlerCount("EVENT_A")).toBe(2);
      expect(messageSystem.getHandlerCount("EVENT_B")).toBe(1);
      expect(messageSystem.getHandlerCount("EVENT_C")).toBe(0);
    });

    it("should allow handler cleanup", () => {
      // Arrange
      const calls: unknown[] = [];
      const cleanup = messageSystem.on("TEST_EVENT", (payload) => {
        calls.push(payload);
      });

      messageSystem.emit("TEST_EVENT", { value: 1 });
      expect(calls).toHaveLength(1);

      // Act - cleanup handler
      cleanup();
      messageSystem.emit("TEST_EVENT", { value: 2 });

      // Assert
      expect(calls).toHaveLength(1); // Should still be 1
    });
  });

  describe("simulateMessage", () => {
    it("should trigger registered handlers without emitting", () => {
      // Arrange
      const receivedPayloads: unknown[] = [];
      messageSystem.on("SIMULATED_EVENT", (payload) => {
        receivedPayloads.push(payload);
      });

      // Act
      messageSystem.simulateMessage("SIMULATED_EVENT", { test: "data" });

      // Assert
      expect(receivedPayloads).toHaveLength(1);
      expect(receivedPayloads[0]).toEqual({ test: "data" });
      
      // Should not be in emitted messages
      expect(messageSystem.wasMessageEmitted("SIMULATED_EVENT")).toBe(false);
    });
  });

  describe("message clearing", () => {
    it("should clear messages", () => {
      // Arrange
      messageSystem.emit("EVENT_1", {});
      messageSystem.emit("EVENT_2", {});
      expect(messageSystem.getEmittedMessages()).toHaveLength(2);

      // Act
      messageSystem.clearMessages();

      // Assert
      expect(messageSystem.getEmittedMessages()).toHaveLength(0);
    });

    it("should clear handlers", () => {
      // Arrange
      messageSystem.on("EVENT", () => {});
      messageSystem.on("EVENT", () => {});
      expect(messageSystem.getHandlerCount("EVENT")).toBe(2);

      // Act
      messageSystem.clearHandlers();

      // Assert
      expect(messageSystem.getHandlerCount("EVENT")).toBe(0);
    });

    it("should reset both messages and handlers", () => {
      // Arrange
      messageSystem.emit("EVENT", {});
      messageSystem.on("EVENT", () => {});

      // Act
      messageSystem.reset();

      // Assert
      expect(messageSystem.getEmittedMessages()).toHaveLength(0);
      expect(messageSystem.getHandlerCount("EVENT")).toBe(0);
    });
  });

  describe("isolation between tests", () => {
    it("should not leak messages from previous test", () => {
      // This test verifies that beforeEach reset works
      const messages = messageSystem.getEmittedMessages();
      expect(messages).toHaveLength(0);
    });

    it("should not leak handlers from previous test", () => {
      // This test verifies that beforeEach reset works
      const handlerCount = messageSystem.getHandlerCount("EVENT");
      expect(handlerCount).toBe(0);
    });
  });

  describe("round-trip helper", () => {
    it("should send message and wait for response", async () => {
      // Arrange
      const roundTrip = createMessageRoundTripHelper(messageSystem);
      
      // Simulate a handler that responds
      messageSystem.on("REQUEST", (payload) => {
        // Simulate async processing
        setTimeout(() => {
          messageSystem.emit("RESPONSE", { 
            result: `Processed: ${(payload as { data: string }).data}` 
          });
        }, 10);
      });

      // Act
      const responsePromise = roundTrip.sendAndWaitForResponse(
        "REQUEST",
        { data: "test" },
        "RESPONSE",
        1000
      );
      
      // Trigger the request
      // (sendAndWaitForResponse already emitted it)
      
      const response = await responsePromise;

      // Assert
      expect(response).toEqual({ result: "Processed: test" });
    });

    it("should timeout if response not received", async () => {
      // Arrange
      const roundTrip = createMessageRoundTripHelper(messageSystem);

      // Act & Assert
      await expect(
        roundTrip.sendAndWaitForResponse(
          "REQUEST",
          {},
          "RESPONSE_NEVER_COMES",
          100 // Short timeout
        )
      ).rejects.toThrow("Timeout");
    });

    it("should verify message sequence", () => {
      // Arrange
      const roundTrip = createMessageRoundTripHelper(messageSystem);

      // Act
      messageSystem.emit("TRIGGER", {});
      messageSystem.emit("OTHER", {});
      messageSystem.emit("RESPONSE", {});

      // Assert
      expect(roundTrip.verifyMessageSequence("TRIGGER", "RESPONSE")).toBe(true);
      expect(roundTrip.verifyMessageSequence("RESPONSE", "TRIGGER")).toBe(false);
      expect(roundTrip.verifyMessageSequence("TRIGGER", "NONEXISTENT")).toBe(false);
    });
  });
});
