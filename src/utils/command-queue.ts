// ============================================================================
// COMMAND QUEUE - Serialize mutating operations to prevent race conditions
// ============================================================================
//
// This utility serializes state-mutating operations (CREATE, UPDATE, DELETE, REORDER)
// to prevent race conditions during async gaps (e.g., figma.loadFontAsync).
// Read operations (GET_SCREENS, SELECTION_CHANGED) bypass the queue for responsiveness.
//

import { Logger } from "./logger";

/**
 * Command type classification
 */
export enum CommandType {
  MUTATE = "MUTATE",
  READ = "READ",
}

/**
 * Command interface for queue operations
 */
export interface Command<T = unknown> {
  id: string;
  type: CommandType;
  name: string;
  handler: () => Promise<T>;
  timestamp: number;
  timeout?: number; // Optional per-command timeout override (in milliseconds)
}

/**
 * CommandQueue serializes mutating operations to prevent race conditions
 */
export class CommandQueue {
  private queue: Command[] = [];
  private processing = false;
  private isInternalMutationFlag = false;
  private timeoutMs = 10000; // Default timeout: 10 seconds

  /**
   * Get the current internal mutation flag state
   */
  get isInternalMutation(): boolean {
    return this.isInternalMutationFlag;
  }

  /**
   * Set the default timeout for command execution
   * @param ms Timeout in milliseconds (default: 10000)
   */
  setTimeout(ms: number): void {
    if (ms <= 0) {
      throw new Error("Timeout must be greater than 0");
    }
    this.timeoutMs = ms;
  }

  /**
   * Get the current default timeout
   */
  getTimeout(): number {
    return this.timeoutMs;
  }

  /**
   * Enqueue a command for execution
   * Returns a promise that resolves when the command completes
   */
  async enqueue<T>(command: Command<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutDuration = command.timeout ?? this.timeoutMs;
      
      // Create timeout promise for this specific command
      const timeoutPromise = new Promise<never>((_, timeoutReject) => {
        setTimeout(() => {
          timeoutReject(
            new Error(
              `Command "${command.name}" (id: ${command.id}) timed out after ${timeoutDuration}ms`
            )
          );
        }, timeoutDuration);
      });

      const wrappedCommand: Command<T> = {
        ...command,
        handler: async () => {
          try {
            // Race the original handler against the timeout
            const result = await Promise.race([
              command.handler(),
              timeoutPromise,
            ]);
            resolve(result);
            return result;
          } catch (error) {
            const errorObj =
              error instanceof Error ? error : new Error(String(error));
            reject(errorObj);
            throw errorObj;
          }
        },
      };

      this.queue.push(wrappedCommand as Command);

      Logger.debug("CommandQueue", "Enqueued", {
        depth: this.queue.length,
        name: command.name,
        type: command.type,
        timeoutMs: timeoutDuration,
      });

      // Start processing if not already running
      if (!this.processing) {
        void this.processNext();
      }
    });
  }

  /**
   * Process the next command in the queue
   */
  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      if (this.queue.length === 0 && !this.processing) {
        Logger.debug("CommandQueue", "Queue drained");
      }
      return;
    }

    this.processing = true;
    const command = this.queue.shift();

    if (!command) {
      this.processing = false;
      return;
    }

    const startTime = Date.now();
    
    Logger.debug("CommandQueue", "Processing", {
      name: command.name,
      type: command.type,
      queueDepth: this.queue.length,
    });

    try {
      // Set internal mutation flag before execution
      this.isInternalMutationFlag = true;

      // Execute the command handler (timeout is already handled in wrapped handler)
      await command.handler();

      const duration = Date.now() - startTime;
      Logger.debug("CommandQueue", "Completed", {
        name: command.name,
        durationMs: duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      const isTimeout = error instanceof Error && error.message.includes("timed out");
      
      if (isTimeout) {
        Logger.error("CommandQueue", "Command timed out", {
          name: command.name,
          id: command.id,
          durationMs: duration,
          error,
        });
      } else {
        Logger.error("CommandQueue", "Command failed", {
          name: command.name,
          durationMs: duration,
          error,
        });
      }
      // Continue processing even if a command fails or times out
      // Note: The promise rejection is already handled in the wrapped handler
    } finally {
      // Always reset the flag after execution (even on timeout)
      this.isInternalMutationFlag = false;
    }

    this.processing = false;

    // Process next command if queue is not empty
    if (this.queue.length > 0) {
      void this.processNext();
    } else {
      Logger.debug("CommandQueue", "Queue drained");
    }
  }

  /**
   * Get current queue depth (for debugging/monitoring)
   */
  getQueueDepth(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

// Export singleton instance
export const commandQueue = new CommandQueue();
