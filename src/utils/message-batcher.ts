// ============================================================================
// MESSAGE BATCHER - Optimize UI updates by batching multiple messages
// ============================================================================

import { emit } from "@create-figma-plugin/utilities";
import { Logger } from "./logger";
import { NodeChangeMessages } from "../types";

/**
 * MessageBatcher optimizes UI communication by batching multiple messages
 * into fewer emissions, reducing overhead and improving performance.
 * 
 * Features:
 * - Priority-based message handling (high/normal/low)
 * - Message deduplication (newer data overwrites older)
 * - Automatic flushing after delay
 * - Performance monitoring and statistics
 * - Batch size limits to prevent memory issues
 */
export class MessageBatcher {
  private pendingMessages: Map<
    string,
    { data: NodeChangeMessages[keyof NodeChangeMessages]; priority: "low" | "normal" | "high"; timestamp: number }
  > = new Map();
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY_MS = 50; // Batch messages for 50ms to reduce communication overhead
  private messageCount = 0;
  private readonly MAX_BATCH_SIZE = 100; // Prevent memory issues with large batches
  private lastFlushTime = 0;
  private flushCount = 0;

  /**
   * Queue a message for batching with priority support
   * @param type - Message type (must match NodeChangeMessages keys)
   * @param data - Message payload
   * @param priority - Priority level (high messages sent immediately)
   */
  queueMessage(
    type: string,
    data: NodeChangeMessages[keyof NodeChangeMessages],
    priority: "low" | "normal" | "high" = "normal"
  ) {
    const now = Date.now();

    // PERFORMANCE OPTIMIZATION: Limit batch size to prevent memory issues
    if (this.pendingMessages.size >= this.MAX_BATCH_SIZE) {
      Logger.warn(
        "Message batch",
        "Batch size limit reached, flushing immediately"
      );
      this.flush();
    }

    // High priority messages are sent immediately
    if (priority === "high") {
      this.sendMessageImmediately(type, data);
      return;
    }

    // Check if message type already exists (deduplication)
    const existing = this.pendingMessages.get(type);
    if (existing) {
      // Update with newer data and higher priority if applicable
      const newPriority = this.getHigherPriority(existing.priority, priority);
      this.pendingMessages.set(type, {
        data,
        priority: newPriority,
        timestamp: now,
      });
      Logger.debug("Message batch", `Updated existing message: ${type}`);
    } else {
      this.pendingMessages.set(type, { data, priority, timestamp: now });
      this.messageCount++;
    }

    // Debounce message sending
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flushMessages();
    }, this.BATCH_DELAY_MS);
  }

  /**
   * Get the higher priority between two priorities
   */
  private getHigherPriority(
    existing: "low" | "normal" | "high",
    incoming: "low" | "normal" | "high"
  ): "low" | "normal" | "high" {
    const priorityOrder = { low: 0, normal: 1, high: 2 };
    return priorityOrder[incoming] > priorityOrder[existing]
      ? incoming
      : existing;
  }

  /**
   * Send high-priority message immediately (bypasses batching)
   */
  private sendMessageImmediately(type: string, data: NodeChangeMessages[keyof NodeChangeMessages]) {
    try {
      emit(type as keyof NodeChangeMessages, data);
      Logger.debug("Message batch", `Sent high-priority message: ${type}`);
    } catch (error) {
      Logger.error(
        "Message batch",
        `Failed to send high-priority ${type}`,
        error
      );
      // For high-priority messages, retry once after a short delay
      setTimeout(() => {
        try {
          emit(type as keyof NodeChangeMessages, data);
        } catch (retryError) {
          Logger.error(
            "Message batch",
            `Failed retry for high-priority ${type}`,
            retryError
          );
        }
      }, 100);
    }
  }

  /**
   * Send all queued messages immediately with performance monitoring
   */
  private flushMessages() {
    if (this.pendingMessages.size === 0) return;

    const startTime = Date.now();
    const messages = Array.from(this.pendingMessages.entries());
    const count = this.messageCount;

    // Sort messages by priority (high first, then normal, then low)
    messages.sort(([, a], [, b]) => {
      const priorityOrder = { high: 2, normal: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    this.pendingMessages.clear();
    this.messageCount = 0;
    this.batchTimeout = null;
    this.lastFlushTime = startTime;
    this.flushCount++;

    let successCount = 0;
    let errorCount = 0;

    // PERFORMANCE OPTIMIZATION: Send batched messages to UI
    for (const [type, messageData] of messages) {
      try {
        emit(type as keyof NodeChangeMessages, messageData.data);
        successCount++;
      } catch (error) {
        Logger.error("Message batch", `Failed to send ${type}`, error);
        errorCount++;
      }
    }

    const duration = Date.now() - startTime;

    // Log performance metrics
    if (count > 1 || duration > 10) {
      Logger.debug(
        "Message batch",
        `Flush #${this.flushCount}: sent ${successCount}/${messages.length} messages (${count} total ops) in ${duration}ms`
      );
    }

    // Warn if we had errors
    if (errorCount > 0) {
      Logger.warn(
        "Message batch",
        `Flush #${this.flushCount}: ${errorCount} messages failed to send`
      );
    }
  }

  /**
   * Force immediate sending of all pending messages
   * Call this before plugin closes to ensure no messages are lost
   */
  flush() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.flushMessages();
  }

  /**
   * Get current batch size for monitoring
   */
  getBatchSize(): number {
    return this.pendingMessages.size;
  }

  /**
   * Get performance statistics
   */
  getStats() {
    return {
      pendingMessages: this.pendingMessages.size,
      totalMessagesProcessed: this.messageCount,
      flushCount: this.flushCount,
      lastFlushTime: this.lastFlushTime,
      avgMessagesPerFlush:
        this.flushCount > 0
          ? Math.round(this.messageCount / this.flushCount)
          : 0,
    };
  }
}

