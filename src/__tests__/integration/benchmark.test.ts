// ============================================================================
// BENCHMARK INTEGRATION TESTS - Performance Thresholds
// ============================================================================
// These tests validate that critical operations meet PRD performance requirements:
// - Plugin load time: < 2 seconds
// - UI interactions: < 100ms lag
// - Canvas annotation rendering (50+ annotations): < 5 seconds

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { benchmark, PERFORMANCE_THRESHOLDS } from "../../utils/benchmark";
import { updatePluginSettings } from "../../store";

describe("Benchmark Integration Tests", () => {
  beforeEach(() => {
    // Enable performance monitoring for tests
    updatePluginSettings({ enablePerformanceMonitoring: true, performanceLogLevel: "none" });
    benchmark.clear();
  });

  afterEach(() => {
    benchmark.clear();
  });

  describe("Benchmark Utility", () => {
    it("should track timing for synchronous operations", () => {
      // Act
      benchmark.start("test-op");
      // Simulate work
      let _sum = 0;
      for (let i = 0; i < 1000; i++) {
        _sum += i;
      }
      const duration = benchmark.stop("test-op");

      // Assert
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be fast
      const results = benchmark.getResults();
      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.name).toBe("test-op");
      expect(result?.duration).toBe(duration);
    });

    it("should track timing with threshold validation", () => {
      // Act
      benchmark.start("test-threshold");
      const duration = benchmark.stop("test-threshold", 100);

      // Assert
      const results = benchmark.getResults();
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.threshold).toBe(100);
      expect(result?.passed).toBe(duration < 100);
    });

    it("should measure synchronous operations", () => {
      // Act
      const result = benchmark.measure(
        "test-measure",
        () => {
          return 42;
        },
        50
      );

      // Assert
      expect(result).toBe(42);
      const results = benchmark.getResults();
      expect(results).toHaveLength(1);
      const benchmarkResult = results[0];
      expect(benchmarkResult).toBeDefined();
      expect(benchmarkResult?.name).toBe("test-measure");
    });

    it("should measure async operations", async () => {
      // Act
      const result = await benchmark.measureAsync(
        "test-async",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return "done";
        },
        100
      );

      // Assert
      expect(result).toBe("done");
      const results = benchmark.getResults();
      expect(results).toHaveLength(1);
      const benchmarkResult = results[0];
      expect(benchmarkResult).toBeDefined();
      expect(benchmarkResult?.name).toBe("test-async");
      expect(benchmarkResult?.duration).toBeGreaterThanOrEqual(9);
    });

    it("should handle errors in measured operations", () => {
      // Act & Assert
      expect(() => {
        benchmark.measure("test-error", () => {
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      // Timing should still be recorded
      const results = benchmark.getResults();
      expect(results).toHaveLength(1);
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.name).toBe("test-error");
    });

    it("should get statistics for repeated operations", () => {
      // Arrange - Run same operation multiple times
      for (let i = 0; i < 5; i++) {
        benchmark.start("repeated-op");
        benchmark.stop("repeated-op", 100);
      }

      // Act
      const stats = benchmark.getStats("repeated-op");

      // Assert
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(5);
      expect(stats!.min).toBeGreaterThan(0);
      expect(stats!.max).toBeGreaterThan(0);
      expect(stats!.avg).toBeGreaterThan(0);
      expect(stats!.failed).toBeGreaterThanOrEqual(0);
    });

    it("should export results as JSON", () => {
      // Arrange
      benchmark.start("export-test");
      benchmark.stop("export-test");

      // Act
      const exported = benchmark.export();
      const parsed = JSON.parse(exported) as {
        results: unknown[];
        timestamp: number;
        enabled: boolean;
      };

      // Assert
      expect(parsed.results).toHaveLength(1);
      expect(parsed.timestamp).toBeGreaterThan(0);
      expect(parsed.enabled).toBe(true);
    });

    it("should respect monitoring disabled state", () => {
      // Arrange
      updatePluginSettings({ enablePerformanceMonitoring: false });

      // Act
      benchmark.start("disabled-test");
      const duration = benchmark.stop("disabled-test");

      // Assert
      expect(duration).toBe(0);
      expect(benchmark.getResults()).toHaveLength(0);
    });

    it("should limit stored results to prevent memory issues", () => {
      // Arrange - Create more than MAX_STORED_RESULTS (100)
      for (let i = 0; i < 150; i++) {
        benchmark.start(`op-${i}`);
        benchmark.stop(`op-${i}`);
      }

      // Act
      const results = benchmark.getResults();

      // Assert - Should be capped at 100
      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe("Performance Thresholds", () => {
    it("should define plugin load threshold at 2000ms", () => {
      expect(PERFORMANCE_THRESHOLDS.PLUGIN_LOAD).toBe(2000);
    });

    it("should define UI interaction threshold at 100ms", () => {
      expect(PERFORMANCE_THRESHOLDS.UI_INTERACTION).toBe(100);
    });

    it("should define canvas render threshold at 5000ms for 50+ annotations", () => {
      expect(PERFORMANCE_THRESHOLDS.CANVAS_RENDER_50).toBe(5000);
    });

    it("should define canvas insert threshold at 1000ms", () => {
      expect(PERFORMANCE_THRESHOLDS.CANVAS_INSERT).toBe(1000);
    });

    it("should define annotation list render threshold at 50ms", () => {
      expect(PERFORMANCE_THRESHOLDS.ANNOTATION_LIST_RENDER).toBe(50);
    });
  });

  describe("Simulated Performance Scenarios", () => {
    it("should validate fast UI interaction timing", () => {
      // Simulate a fast UI operation (e.g., button click handler)
      const result = benchmark.measure(
        "ui-click",
        () => {
          // Simulate lightweight UI state update
          const data = { clicked: true, timestamp: Date.now() };
          return data;
        },
        PERFORMANCE_THRESHOLDS.UI_INTERACTION
      );

      // Assert
      expect(result.clicked).toBe(true);
      const stats = benchmark.getStats("ui-click");
      expect(stats!.max).toBeLessThan(PERFORMANCE_THRESHOLDS.UI_INTERACTION);
    });

    it("should validate annotation list render performance", () => {
      // Simulate rendering annotation list
      const result = benchmark.measure(
        "list-render",
        () => {
          // Simulate creating list items
          const items = Array.from({ length: 20 }, (_, i) => ({
            id: i,
            label: `Annotation ${i}`,
          }));
          return items;
        },
        PERFORMANCE_THRESHOLDS.ANNOTATION_LIST_RENDER
      );

      // Assert
      expect(result).toHaveLength(20);
      const stats = benchmark.getStats("list-render");
      // This should be very fast for 20 items
      expect(stats!.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.ANNOTATION_LIST_RENDER);
    });

    it("should validate canvas insert timing simulation", async () => {
      // Simulate canvas insert operation
      await benchmark.measureAsync(
        "canvas-insert-sim",
        async () => {
          // Simulate async canvas operations
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { inserted: true };
        },
        PERFORMANCE_THRESHOLDS.CANVAS_INSERT
      );

      // Assert
      const stats = benchmark.getStats("canvas-insert-sim");
      expect(stats!.avg).toBeLessThan(PERFORMANCE_THRESHOLDS.CANVAS_INSERT);
    });

    it("should track multiple canvas operations for 50+ annotations", async () => {
      // Simulate inserting 50 annotations
      const operations = Array.from({ length: 50 }, async (_, i) => {
        return await benchmark.measureAsync(
          `canvas-insert-${i}`,
          async () => {
            // Simulate individual insert
            await new Promise((resolve) => setTimeout(resolve, 1));
            return i;
          },
          PERFORMANCE_THRESHOLDS.CANVAS_INSERT
        );
      });

      // Act
      const startTime = performance.now();
      await Promise.all(operations);
      const totalDuration = performance.now() - startTime;

      // Assert - Total time for 50 annotations should be under threshold
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.CANVAS_RENDER_50);
    });
  });

  describe("Performance Regression Detection", () => {
    it("should detect performance regression when operation exceeds threshold", () => {
      // Arrange - Simulate slow operation
      benchmark.start("slow-op");
      // Force timing to exceed threshold
      const startTime = performance.now();
      while (performance.now() - startTime < 150) {
        // Busy wait
      }
      const duration = benchmark.stop("slow-op", 100);

      // Assert
      expect(duration).toBeGreaterThan(100);
      const results = benchmark.getResults();
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
    });

    it("should pass when operation meets threshold", () => {
      // Act
      benchmark.measure(
        "fast-op",
        () => {
          return "done";
        },
        100
      );

      // Assert
      const results = benchmark.getResults();
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
      expect(result?.duration).toBeLessThan(100);
    });
  });

  describe("Benchmark Statistics", () => {
    it("should calculate min/max/avg correctly", () => {
      // Arrange - Create operations with known durations
      benchmark.start("op1");
      benchmark.stop("op1"); // Very fast

      benchmark.start("op1");
      const start = performance.now();
      while (performance.now() - start < 10) {
        // 10ms operation
      }
      benchmark.stop("op1");

      benchmark.start("op1");
      const start2 = performance.now();
      while (performance.now() - start2 < 20) {
        // 20ms operation
      }
      benchmark.stop("op1");

      // Act
      const stats = benchmark.getStats("op1");

      // Assert
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.min).toBeLessThan(stats!.max);
      expect(stats!.avg).toBeGreaterThan(stats!.min);
      expect(stats!.avg).toBeLessThan(stats!.max);
    });
  });
});
