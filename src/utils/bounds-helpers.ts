// ============================================================================
// BOUNDS CALCULATION UTILITIES - Using @create-figma-plugin/utilities
// ============================================================================

import { computeMaximumBounds } from "@create-figma-plugin/utilities";
import { Logger } from "./logger";
import { Annotation } from "../types";

// Rectangle type for collision detection
export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate the maximum bounds of multiple annotations for positioning
export async function computeAnnotationsBounds(
  annotations: Annotation[]
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (annotations.length === 0) return null;

  try {
    // Get all the nodes that have annotations
    const nodes: SceneNode[] = [];
    for (const ann of annotations) {
      try {
        const node = await figma.getNodeByIdAsync(ann.elementId);
        if (node && !node.removed && node.type !== "DOCUMENT") {
          nodes.push(node as SceneNode);
        }
      } catch (_error) {
        Logger.debug("Bounds calculation", "Skipping removed node", {
          annotationId: ann.id,
          elementId: ann.elementId,
        });
      }
    }

    if (nodes.length === 0) return null;

    // Use computeMaximumBounds to get the overall bounds
    const [topLeft, bottomRight] = computeMaximumBounds(nodes);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  } catch (error) {
    Logger.error(
      "Bounds calculation",
      "Failed to compute annotation bounds",
      error
    );
    return null;
  }
}

/**
 * Detect if two rectangles overlap
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns true if rectangles overlap, false otherwise
 */
export function detectOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
  // Two rectangles overlap if they intersect on both axes
  // No overlap if one rectangle is to the left/right/above/below the other
  const noOverlapX = rect1.x + rect1.width <= rect2.x || rect2.x + rect2.width <= rect1.x;
  const noOverlapY = rect1.y + rect1.height <= rect2.y || rect2.y + rect2.height <= rect1.y;
  
  return !noOverlapX && !noOverlapY;
}

/**
 * Find a non-overlapping position for a new rectangle by nudging it down
 * @param newRect - The rectangle to position
 * @param existingRects - Array of existing rectangles to avoid
 * @param nudgeStep - Pixels to nudge down per iteration (default: 20)
 * @returns Updated rectangle with non-overlapping position
 */
export function findNonOverlappingPosition(
  newRect: Rectangle,
  existingRects: Rectangle[],
  nudgeStep: number = 20
): Rectangle {
  if (existingRects.length === 0) {
    return newRect;
  }

  let candidateRect = { ...newRect };
  const MAX_COLLISION_AVOIDANCE_ITERATIONS = 100; // Safety limit to prevent infinite loops
  let iterations = 0;

  while (iterations < MAX_COLLISION_AVOIDANCE_ITERATIONS) {
    // Check if current position overlaps with any existing rectangle
    const hasOverlap = existingRects.some((existingRect) =>
      detectOverlap(candidateRect, existingRect)
    );

    if (!hasOverlap) {
      // Found a non-overlapping position
      return candidateRect;
    }

    // Nudge down and try again
    candidateRect = {
      ...candidateRect,
      y: candidateRect.y + nudgeStep,
    };
    iterations++;
  }

  Logger.warn(
    "Collision avoidance",
    "Max iterations reached, returning last position",
    { iterations: MAX_COLLISION_AVOIDANCE_ITERATIONS, finalY: candidateRect.y }
  );
  
  return candidateRect;
}

