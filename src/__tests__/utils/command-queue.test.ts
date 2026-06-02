// ============================================================================
// COMMAND QUEUE TESTS - Test command serialization and execution
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { CommandQueue, CommandType } from "../../utils/command-queue";

describe("CommandQueue", () => {
  let queue: CommandQueue;

  beforeEach(() => {
    queue = new CommandQueue();
  });

  describe("FIFO execution order", () => {
    it("should execute commands in FIFO order", async () => {
      const executionOrder: number[] = [];

      const command1 = queue.enqueue({
        id: "1",
        type: CommandType.MUTATE,
        name: "command1",
        handler: () => {
          executionOrder.push(1);
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("result1"), 10);
          });
        },
        timestamp: Date.now(),
      });

      const command2 = queue.enqueue({
        id: "2",
        type: CommandType.MUTATE,
        name: "command2",
        handler: () => {
          executionOrder.push(2);
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("result2"), 10);
          });
        },
        timestamp: Date.now(),
      });

      const command3 = queue.enqueue({
        id: "3",
        type: CommandType.MUTATE,
        name: "command3",
        handler: () => {
          executionOrder.push(3);
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("result3"), 10);
          });
        },
        timestamp: Date.now(),
      });

      await Promise.all([command1, command2, command3]);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should process commands sequentially even when enqueued concurrently", async () => {
      const executionOrder: number[] = [];

      // Enqueue all commands at once
      const promises = Array.from({ length: 5 }, (_, i) =>
        queue.enqueue({
          id: `cmd-${i}`,
          type: CommandType.MUTATE,
          name: `command${i}`,
          handler: () => {
            executionOrder.push(i);
            return new Promise<string>((resolve) => {
              setTimeout(() => resolve(`result${i}`), 5);
            });
          },
          timestamp: Date.now(),
        })
      );

      await Promise.all(promises);

      // Should execute in order 0, 1, 2, 3, 4
      expect(executionOrder).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe("isInternalMutation flag", () => {
    it("should be false initially", () => {
      expect(queue.isInternalMutation).toBe(false);
    });

    it("should be true during command execution", async () => {
      let flagDuringExecution = false;

      const promise = queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => {
          flagDuringExecution = queue.isInternalMutation;
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("result"), 10);
          });
        },
        timestamp: Date.now(),
      });

      await promise;

      expect(flagDuringExecution).toBe(true);
      expect(queue.isInternalMutation).toBe(false);
    });

    it("should be false after command execution completes", async () => {
      await queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => Promise.resolve("result"),
        timestamp: Date.now(),
      });

      expect(queue.isInternalMutation).toBe(false);
    });

    it("should be false even if command throws error", async () => {
      try {
        await queue.enqueue({
          id: "test",
          type: CommandType.MUTATE,
          name: "test",
          handler: () => Promise.reject(new Error("Test error")),
          timestamp: Date.now(),
        });
      } catch {
        // Expected error
      }

      expect(queue.isInternalMutation).toBe(false);
    });
  });

  describe("Error handling", () => {
    it("should continue processing after a command fails", async () => {
      const executionOrder: number[] = [];

      const command1 = queue.enqueue({
        id: "1",
        type: CommandType.MUTATE,
        name: "command1",
        handler: () => {
          executionOrder.push(1);
          return Promise.reject(new Error("Command 1 failed"));
        },
        timestamp: Date.now(),
      });

      const command2 = queue.enqueue({
        id: "2",
        type: CommandType.MUTATE,
        name: "command2",
        handler: () => {
          executionOrder.push(2);
          return Promise.resolve("result2");
        },
        timestamp: Date.now(),
      });

      await expect(command1).rejects.toThrow("Command 1 failed");
      await expect(command2).resolves.toBe("result2");

      expect(executionOrder).toEqual([1, 2]);
    });

    it("should reject promise when command fails", async () => {
      const command = queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => Promise.reject(new Error("Test error")),
        timestamp: Date.now(),
      });

      await expect(command).rejects.toThrow("Test error");
    });
  });

  describe("Queue depth tracking", () => {
    it("should track queue depth correctly", async () => {
      const depths: number[] = [];

      // Enqueue all commands first to ensure they're all in the queue
      const command1Promise = queue.enqueue({
        id: "1",
        type: CommandType.MUTATE,
        name: "command1",
        handler: () => {
          // Small delay to ensure other commands are enqueued
          return new Promise<string>((resolve) => {
            setTimeout(() => {
              depths.push(queue.getQueueDepth());
              setTimeout(() => resolve("result1"), 15);
            }, 5);
          });
        },
        timestamp: Date.now(),
      });

      const command2Promise = queue.enqueue({
        id: "2",
        type: CommandType.MUTATE,
        name: "command2",
        handler: () => {
          depths.push(queue.getQueueDepth());
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("result2"), 10);
          });
        },
        timestamp: Date.now(),
      });

      const command3Promise = queue.enqueue({
        id: "3",
        type: CommandType.MUTATE,
        name: "command3",
        handler: () => {
          depths.push(queue.getQueueDepth());
          return Promise.resolve("result3");
        },
        timestamp: Date.now(),
      });

      await Promise.all([command1Promise, command2Promise, command3Promise]);

      // When command1 executes (after delay), queue should have 2 items (command2, command3)
      // When command2 executes, queue should have 1 item (command3)
      // When command3 executes, queue should have 0 items
      expect(depths).toEqual([2, 1, 0]);
    });

    it("should return 0 when queue is empty", () => {
      expect(queue.getQueueDepth()).toBe(0);
    });
  });

  describe("Processing state", () => {
    it("should report processing state correctly", async () => {
      expect(queue.isProcessing()).toBe(false);

      const command = queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => {
          // Check processing state during execution
          const isProcessing = queue.isProcessing();
          return new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(isProcessing), 10);
          });
        },
        timestamp: Date.now(),
      });

      const result = await command;
      expect(result).toBe(true);
      expect(queue.isProcessing()).toBe(false);
    });
  });

  describe("Command return values", () => {
    it("should return command result", async () => {
      const result = await queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => Promise.resolve("test-result"),
        timestamp: Date.now(),
      });

      expect(result).toBe("test-result");
    });

    it("should handle async command results", async () => {
      const result = await queue.enqueue({
        id: "test",
        type: CommandType.MUTATE,
        name: "test",
        handler: () => {
          return new Promise<{ data: string }>((resolve) => {
            setTimeout(() => resolve({ data: "async-result" }), 10);
          });
        },
        timestamp: Date.now(),
      });

      expect(result).toEqual({ data: "async-result" });
    });
  });

  describe("Timeout protection", () => {
    it("should timeout command after configured duration", async () => {
      queue.setTimeout(50); // Set short timeout for test

      const commandPromise = queue.enqueue({
        id: "timeout-test",
        type: CommandType.MUTATE,
        name: "hanging-command",
        handler: () => {
          // This will never resolve
          return new Promise<string>(() => {
            // Intentionally never resolves
          });
        },
        timestamp: Date.now(),
      });

      await expect(commandPromise).rejects.toThrow(/timed out after 50ms/);
    });

    it("should continue processing after timeout", async () => {
      queue.setTimeout(50);
      const executionOrder: number[] = [];

      const hangingCommand = queue.enqueue({
        id: "hanging",
        type: CommandType.MUTATE,
        name: "hanging",
        handler: () => {
          return new Promise<string>(() => {
            // Never resolves
          });
        },
        timestamp: Date.now(),
      });

      const nextCommand = queue.enqueue({
        id: "next",
        type: CommandType.MUTATE,
        name: "next",
        handler: () => {
          executionOrder.push(1);
          return Promise.resolve("success");
        },
        timestamp: Date.now(),
      });

      // Hanging command should timeout
      await expect(hangingCommand).rejects.toThrow(/timed out/);

      // Next command should execute
      await expect(nextCommand).resolves.toBe("success");
      expect(executionOrder).toEqual([1]);
    });

    it("should reset isInternalMutation flag after timeout", async () => {
      queue.setTimeout(50);

      const hangingCommand = queue.enqueue({
        id: "hanging",
        type: CommandType.MUTATE,
        name: "hanging",
        handler: () => {
          return new Promise<string>(() => {
            // Never resolves
          });
        },
        timestamp: Date.now(),
      });

      try {
        await hangingCommand;
      } catch {
        // Expected timeout
      }

      // Flag should be reset even after timeout
      expect(queue.isInternalMutation).toBe(false);
    });

    it("should allow per-command timeout override", async () => {
      queue.setTimeout(1000); // Default timeout

      // Command with shorter timeout
      const shortTimeoutCommand = queue.enqueue({
        id: "short",
        type: CommandType.MUTATE,
        name: "short-timeout",
        timeout: 50, // Override to 50ms
        handler: () => {
          return new Promise<string>(() => {
            // Never resolves
          });
        },
        timestamp: Date.now(),
      });

      await expect(shortTimeoutCommand).rejects.toThrow(/timed out after 50ms/);
    });

    it("should complete successfully if handler finishes before timeout", async () => {
      queue.setTimeout(100);

      const result = await queue.enqueue({
        id: "fast",
        type: CommandType.MUTATE,
        name: "fast-command",
        handler: () => {
          return new Promise<string>((resolve) => {
            setTimeout(() => resolve("completed"), 10);
          });
        },
        timestamp: Date.now(),
      });

      expect(result).toBe("completed");
    });

    it("should handle timeout configuration", () => {
      expect(queue.getTimeout()).toBe(10000); // Default

      queue.setTimeout(5000);
      expect(queue.getTimeout()).toBe(5000);

      expect(() => queue.setTimeout(0)).toThrow("Timeout must be greater than 0");
      expect(() => queue.setTimeout(-1)).toThrow("Timeout must be greater than 0");
    });
  });
});
