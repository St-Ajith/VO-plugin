// ============================================================================
// BOUNDS HELPERS TESTS - Test collision detection utilities
// ============================================================================

import { describe, it, expect } from "vitest";
import { detectOverlap, findNonOverlappingPosition, type Rectangle } from "../../utils/bounds-helpers";

describe("detectOverlap", () => {
  it("should detect overlap when rectangles intersect", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 100, height: 100 };
    const rect2: Rectangle = { x: 50, y: 50, width: 100, height: 100 };
    
    expect(detectOverlap(rect1, rect2)).toBe(true);
  });

  it("should detect no overlap when rectangles are side by side", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 100, height: 100 };
    const rect2: Rectangle = { x: 100, y: 0, width: 100, height: 100 };
    
    expect(detectOverlap(rect1, rect2)).toBe(false);
  });

  it("should detect no overlap when rectangles are vertically separated", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 100, height: 100 };
    const rect2: Rectangle = { x: 0, y: 100, width: 100, height: 100 };
    
    expect(detectOverlap(rect1, rect2)).toBe(false);
  });

  it("should detect overlap when one rectangle is inside another", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 200, height: 200 };
    const rect2: Rectangle = { x: 50, y: 50, width: 50, height: 50 };
    
    expect(detectOverlap(rect1, rect2)).toBe(true);
  });

  it("should detect no overlap when rectangles touch at edges", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 100, height: 100 };
    const rect2: Rectangle = { x: 100, y: 100, width: 100, height: 100 };
    
    expect(detectOverlap(rect1, rect2)).toBe(false);
  });

  it("should detect overlap with partial intersection", () => {
    const rect1: Rectangle = { x: 0, y: 0, width: 150, height: 100 };
    const rect2: Rectangle = { x: 100, y: 50, width: 100, height: 100 };
    
    expect(detectOverlap(rect1, rect2)).toBe(true);
  });
});

describe("findNonOverlappingPosition", () => {
  it("should return original position when no existing rectangles", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };
    const result = findNonOverlappingPosition(newRect, []);
    
    expect(result).toEqual(newRect);
  });

  it("should return original position when no overlap exists", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };
    const existingRects: Rectangle[] = [
      { x: 400, y: 100, width: 200, height: 150 },
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects);
    
    expect(result).toEqual(newRect);
  });

  it("should nudge down by default step (20px) when overlap exists", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 150 };
    const existingRects: Rectangle[] = [
      { x: 100, y: 100, width: 200, height: 150 },
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects);
    
    // Should be nudged down until no overlap
    // Original rect ends at y=250, so new rect should start at y >= 250
    expect(result.y).toBeGreaterThanOrEqual(250);
    expect(result.x).toBe(newRect.x); // X should not change
    expect(result.width).toBe(newRect.width);
    expect(result.height).toBe(newRect.height);
  });

  it("should use custom nudge step when provided", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 100 };
    const existingRects: Rectangle[] = [
      { x: 100, y: 100, width: 200, height: 100 },
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects, 50);
    
    // With 50px step, it should take 2 iterations (100 -> 150 still overlaps, 150 -> 200 works)
    expect(result.y).toBe(200);
  });

  it("should handle multiple existing rectangles", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 100 };
    const existingRects: Rectangle[] = [
      { x: 100, y: 100, width: 200, height: 100 }, // y: 100-200
      { x: 100, y: 200, width: 200, height: 100 }, // y: 200-300
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects);
    
    // Should be placed after both existing rectangles
    expect(result.y).toBeGreaterThanOrEqual(300);
  });

  it("should handle rectangles at different x positions", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 100 };
    const existingRects: Rectangle[] = [
      { x: 400, y: 100, width: 200, height: 100 }, // Different x, no overlap
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects);
    
    // No overlap due to x separation, should return original position
    expect(result).toEqual(newRect);
  });

  it("should nudge multiple times if necessary", () => {
    const newRect: Rectangle = { x: 100, y: 100, width: 200, height: 100 };
    const existingRects: Rectangle[] = [
      { x: 100, y: 100, width: 200, height: 150 }, // y: 100-250
    ];
    
    const result = findNonOverlappingPosition(newRect, existingRects, 10);
    
    // With 10px step, should take multiple iterations to clear y=250
    expect(result.y).toBeGreaterThanOrEqual(250);
    // Check it's a multiple of 10 from original position
    expect((result.y - newRect.y) % 10).toBe(0);
  });
});
