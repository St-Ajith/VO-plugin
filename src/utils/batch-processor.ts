// ============================================================================
// BATCH PROCESSOR - Concurrent operation batching with priority support
// ============================================================================

import { Logger } from "./logger";

interface BatchOperation<T> {
  id: string;
  operation: () => Promise<T>;
  description: string;
  priority: "high" | "normal" | "low";
}

interface BatchResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  duration: number;
}

export class BatchProcessor {
  private maxConcurrency: number;
  private operations: BatchOperation<unknown>[] = [];
  private results: Map<string, BatchResult<unknown>> = new Map();

  constructor(pluginSettings?: { sync?: { maxConcurrentSyncs?: number } }) {
    // Use plugin settings for concurrency, fallback to default
    this.maxConcurrency = pluginSettings?.sync?.maxConcurrentSyncs || 3;
  }

  addOperation<T>(
    id: string,
    operation: () => Promise<T>,
    description: string,
    priority: "high" | "normal" | "low" = "normal"
  ) {
    this.operations.push({ id, operation, description, priority });
  }

  async executeBatch(
    onProgress?: (completed: number, total: number, currentOp: string) => void
  ): Promise<Map<string, BatchResult<unknown>>> {
    // Sort by priority (high first)
    this.operations.sort((a, b) => {
      const priorityOrder = { high: 2, normal: 1, low: 0 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });

    const total = this.operations.length;
    let completed = 0;

    // Execute in batches with concurrency control
    const batches: BatchOperation<unknown>[][] = [];
    for (let i = 0; i < this.operations.length; i += this.maxConcurrency) {
      batches.push(this.operations.slice(i, i + this.maxConcurrency));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (op) => {
        const startTime = Date.now();
        try {
          const result = await op.operation();
          const duration = Date.now() - startTime;
          this.results.set(op.id, { success: true, result, duration });
          Logger.debug("Batch operation", `Completed: ${op.description}`, {
            duration,
          });
        } catch (error) {
          const duration = Date.now() - startTime;
          this.results.set(op.id, {
            success: false,
            error: error as Error,
            duration,
          });
          Logger.error("Batch operation", `Failed: ${op.description}`, error);
        } finally {
          completed++;
          if (onProgress) {
            onProgress(completed, total, op.description);
          }
        }
      });

      await Promise.allSettled(batchPromises);
    }

    return this.results;
  }

  getResults(): Map<string, BatchResult<unknown>> {
    return new Map(this.results);
  }

  getSuccessCount(): number {
    return Array.from(this.results.values()).filter((r) => r.success).length;
  }

  getFailureCount(): number {
    return Array.from(this.results.values()).filter((r) => !r.success).length;
  }
}

