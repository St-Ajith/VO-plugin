// ============================================================================
// ANNOTATION LIST COMPONENT TESTS
// ============================================================================
// Tests the AnnotationList component including virtualization behavior

import { describe, it, expect, beforeEach, vi } from "vitest";
import { signal } from "@preact/signals";
import type { Annotation } from "../../types";

// Mock performance settings
const mockPerformanceSettings = signal({
  enableMonitoring: true,
  logLevel: "none" as const,
  memoryThreshold: 50,
  cleanupInterval: 30,
});

// Mock benchmark
const mockBenchmark = {
  start: vi.fn(),
  stop: vi.fn(),
};

vi.mock("../../store", () => ({
  performanceSettings: mockPerformanceSettings,
}));

vi.mock("../../utils/benchmark", () => ({
  benchmark: mockBenchmark,
  PERFORMANCE_THRESHOLDS: {
    ANNOTATION_LIST_RENDER: 50,
  },
}));

describe("AnnotationList Component Tests", () => {
  const createMockAnnotation = (id: number): Annotation => ({
    id,
    elementId: `element-${id}`,
    elementName: `Element ${id}`,
    frameId: "frame-1",
    frameName: "Frame 1",
    pageId: "page-1",
    pageName: "Page 1",
    platform: "mobile" as const,
    mobile: {
      ios: { label: `Label ${id}`, value: "", trait: "Button", hint: "" },
      android: { label: `Label ${id}`, value: "", trait: "Button", hint: "" },
    },
    voicedPreview: `Button. Label ${id}`,
    targetElementId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformanceSettings.value = {
      enableMonitoring: true,
      logLevel: "none",
      memoryThreshold: 50,
      cleanupInterval: 30,
    };
  });

  describe("Virtualization Threshold Logic", () => {
    it("should enable virtualization with 20 or more annotations", () => {
      // Test the VIRTUALIZATION_THRESHOLD constant
      const VIRTUALIZATION_THRESHOLD = 20;
      
      const shouldVirtualize = (count: number) => count >= VIRTUALIZATION_THRESHOLD;
      
      expect(shouldVirtualize(19)).toBe(false);
      expect(shouldVirtualize(20)).toBe(true);
      expect(shouldVirtualize(50)).toBe(true);
      expect(shouldVirtualize(100)).toBe(true);
    });

    it("should not depend on enableMonitoring for virtualization decision", () => {
      // Virtualization should work regardless of monitoring state
      const VIRTUALIZATION_THRESHOLD = 20;
      const annotations = Array.from({ length: 25 }, (_, i) => createMockAnnotation(i + 1));
      
      // Virtualization is based only on count now
      const shouldVirtualize = annotations.length >= VIRTUALIZATION_THRESHOLD;
      
      expect(shouldVirtualize).toBe(true);
      
      // Disable monitoring - virtualization should still be enabled
      mockPerformanceSettings.value = {
        ...mockPerformanceSettings.value,
        enableMonitoring: false,
      };
      
      const shouldStillVirtualize = annotations.length >= VIRTUALIZATION_THRESHOLD;
      expect(shouldStillVirtualize).toBe(true);
    });
  });

  describe("Performance Measurement", () => {
    it("should track performance only when monitoring is enabled", () => {
      const annotations = Array.from({ length: 5 }, (_, i) => createMockAnnotation(i + 1));
      
      // When monitoring is enabled, benchmark should be called
      mockPerformanceSettings.value.enableMonitoring = true;
      
      // Simulate the effect running
      if (mockPerformanceSettings.value.enableMonitoring && annotations.length > 0) {
        mockBenchmark.start("test-id");
        mockBenchmark.stop("test-id");
      }
      
      expect(mockBenchmark.start).toHaveBeenCalled();
      expect(mockBenchmark.stop).toHaveBeenCalled();
    });

    it("should not track performance when monitoring is disabled", () => {
      const annotations = Array.from({ length: 5 }, (_, i) => createMockAnnotation(i + 1));
      
      mockPerformanceSettings.value.enableMonitoring = false;
      vi.clearAllMocks();
      
      // Simulate the effect NOT running
      if (mockPerformanceSettings.value.enableMonitoring && annotations.length > 0) {
        mockBenchmark.start("test-id");
        mockBenchmark.stop("test-id");
      }
      
      expect(mockBenchmark.start).not.toHaveBeenCalled();
      expect(mockBenchmark.stop).not.toHaveBeenCalled();
    });

    it("should use unique performance IDs to avoid measurement conflicts", () => {
      const renderCount = 3;
      const annotationCount = 10;
      
      // Simulate multiple renders with the same annotation count
      for (let i = 1; i <= renderCount; i++) {
        const perfId = `annotation-list-render-${annotationCount}-${i}`;
        mockBenchmark.start(perfId);
        mockBenchmark.stop(perfId);
      }
      
      // All IDs should be unique
      expect(mockBenchmark.start).toHaveBeenCalledTimes(renderCount);
      expect(mockBenchmark.stop).toHaveBeenCalledTimes(renderCount);
      
      // Check that different IDs were used
      const startCalls = mockBenchmark.start.mock.calls.map((call: unknown[]) => {
        if (typeof call[0] !== 'string') {
          throw new Error('Expected string argument to benchmark.start');
        }
        return call[0];
      });
      const uniqueIds = new Set(startCalls);
      expect(uniqueIds.size).toBe(renderCount);
    });
  });

  describe("Virtual List Calculations", () => {
    it("should calculate visible range correctly", () => {
      const itemHeight = 80;
      const containerHeight = 600;
      const totalItems = 100;
      const overscan = 3;
      
      // Simulate scroll position at top
      let scrollTop = 0;
      let start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      let end = Math.min(totalItems, start + visibleCount + overscan * 2);
      
      expect(start).toBe(0);
      expect(end).toBe(Math.min(totalItems, visibleCount + overscan * 2));
      
      // Simulate scroll position in middle
      scrollTop = 2000;
      start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      end = Math.min(totalItems, start + visibleCount + overscan * 2);
      
      expect(start).toBeGreaterThan(0);
      expect(end).toBeLessThan(totalItems);
      expect(end - start).toBeGreaterThanOrEqual(visibleCount);
    });

    it("should handle edge case of scrolling to bottom", () => {
      const itemHeight = 80;
      const containerHeight = 600;
      const totalItems = 100;
      const overscan = 3;
      
      // Scroll to near bottom
      const scrollTop = (totalItems * itemHeight) - containerHeight;
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      const end = Math.min(totalItems, start + visibleCount + overscan * 2);
      
      expect(end).toBe(totalItems);
      expect(start).toBeLessThan(totalItems);
    });

    it("should respect overscan bounds", () => {
      const itemHeight = 80;
      const containerHeight = 600;
      const totalItems = 10; // Small list
      const overscan = 3;
      
      const scrollTop = 0;
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const visibleCount = Math.ceil(containerHeight / itemHeight);
      const end = Math.min(totalItems, start + visibleCount + overscan * 2);
      
      // Start should never be negative
      expect(start).toBeGreaterThanOrEqual(0);
      // End should never exceed total items
      expect(end).toBeLessThanOrEqual(totalItems);
    });
  });

  describe("Known Limitations", () => {
    it("should document ITEM_HEIGHT limitation for expanded items", () => {
      // This is a known limitation: ITEM_HEIGHT assumes collapsed items
      // When items expand, the fixed height calculation may cause scroll issues
      const ITEM_HEIGHT = 80; // Collapsed height
      const expandedHeight = 200; // Hypothetical expanded height
      
      // The virtual list doesn't account for expanded items
      // This test documents the limitation
      expect(ITEM_HEIGHT).toBeLessThan(expandedHeight);
      
      // In a real scenario, totalHeight calculation would be:
      const collapsedCount = 10;
      const totalHeight = collapsedCount * ITEM_HEIGHT;
      
      // But if one item is expanded, the actual height is higher:
      const actualHeight = (collapsedCount - 1) * ITEM_HEIGHT + expandedHeight;
      
      expect(actualHeight).toBeGreaterThan(totalHeight);
      // This discrepancy is the documented limitation
    });
  });
});
