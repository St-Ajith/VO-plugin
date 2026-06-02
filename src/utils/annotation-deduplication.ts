// ============================================================================
// ANNOTATION DEDUPLICATION UTILITIES
// ============================================================================

import {
  compareObjects,
  deduplicateArray,
  compareStringArrays as compareStringArraysUtil,
} from "@create-figma-plugin/utilities";

import { Annotation } from "../types";
import { Logger } from "./logger";
import { ValidationService } from "../services/validation";

/**
 * Remove duplicate annotations using multiple deduplication strategies.
 * This is the main public API for annotation deduplication.
 *
 * @param annotations - Array of annotations to deduplicate
 * @param validation - ValidationService instance for validating annotations
 * @returns Deduplicated array of annotations
 */
export function removeDuplicateAnnotations(
  annotations: Annotation[],
  validation: ValidationService
): Annotation[] {
  Logger.debug(
    "Deduplication",
    `Starting deduplication of ${annotations.length} annotations`
  );

  // First pass: deduplicate by ID (keep first occurrence)
  const deduplicatedById = deduplicateAnnotationsById(annotations);

  // Second pass: deduplicate by content (keep first occurrence)
  const deduplicatedByContent =
    deduplicateAnnotationsByContent(deduplicatedById);

  // Third pass: validate all remaining annotations
  const validated = deduplicatedByContent.filter((ann) => {
    const validationResult = validation.validateAnnotationData(ann);
    if (!validationResult.isValid) {
      Logger.warn(
        "Deduplication",
        "Removing invalid annotation during cleanup",
        {
          id: ann.id,
          errors: validationResult.errors,
        }
      );
      return false;
    }
    return true;
  });

  Logger.info(
    "Deduplication",
    `Completed: ${annotations.length} → ${validated.length} annotations`
  );
  return validated;
}

/**
 * Remove duplicates based on composite key (frameId:id).
 * Annotation IDs are frame-scoped, so we need frameId to identify true duplicates.
 * Keeps the first occurrence of each composite key.
 */
function deduplicateAnnotationsById(annotations: Annotation[]): Annotation[] {
  const seenKeys = new Set<string>();
  const deduplicated: Annotation[] = [];

  for (const annotation of annotations) {
    const compositeKey = `${annotation.frameId}:${annotation.id}`;
    if (!seenKeys.has(compositeKey)) {
      seenKeys.add(compositeKey);
      deduplicated.push(annotation);
    } else {
      Logger.warn("Deduplication", "Dropping duplicate annotation", {
        compositeKey,
        elementId: annotation.elementId,
      });
    }
  }

  Logger.debug(
    "Deduplication",
    `Removed ${annotations.length - deduplicated.length} duplicate IDs`
  );
  return deduplicated;
}

/**
 * Remove duplicates based on annotation content.
 * Uses content signature comparison to detect duplicates.
 */
function deduplicateAnnotationsByContent(
  annotations: Annotation[]
): Annotation[] {
  const seenContents = new Set<string>();
  const deduplicated: Annotation[] = [];

  for (const annotation of annotations) {
    // Create a content signature for comparison
    const contentSignature =
      createAnnotationContentSignature(annotation);

    if (!seenContents.has(contentSignature)) {
      seenContents.add(contentSignature);
      deduplicated.push(annotation);
    } else {
      Logger.warn("Deduplication", "Duplicate annotation content found", {
        id: annotation.id,
        elementId: annotation.elementId,
      });
    }
  }

  Logger.debug(
    "Deduplication",
    `Removed ${annotations.length - deduplicated.length} duplicate contents`
  );
  return deduplicated;
}

/**
 * Create a normalized signature for content comparison.
 * This signature represents the semantic content of an annotation,
 * excluding metadata like timestamps and IDs.
 * Includes frameId to prevent cross-frame false-positive deduplication.
 */
function createAnnotationContentSignature(annotation: Annotation): string {
  // Create a normalized signature for content comparison
  // Include frameId to ensure annotations on different frames are not collapsed
  const normalized = {
    frameId: annotation.frameId,
    platform: annotation.platform,
    elementId: annotation.elementId,
    mobile: annotation.mobile
      ? {
          ios: annotation.mobile.ios,
          android: annotation.mobile.android,
        }
      : undefined,
    web: annotation.web
      ? {
          ariaLabel: annotation.web.ariaLabel,
          role: annotation.web.role,
          ariaDescribedBy: annotation.web.ariaDescribedBy,
          tabIndex: annotation.web.tabIndex,
        }
      : undefined,
  };

  return JSON.stringify(normalized);
}

/**
 * Remove duplicates from canvas annotations based on composite key (frameId:id).
 * Annotation IDs are frame-scoped, so we need frameId to identify true duplicates.
 * Used specifically for canvas validation.
 */
export function deduplicateCanvasAnnotations(
  annotations: Annotation[]
): Annotation[] {
  // Remove duplicates based on composite key (frameId:id)
  const seenKeys = new Set<string>();
  const deduplicated: Annotation[] = [];

  for (const annotation of annotations) {
    const compositeKey = `${annotation.frameId}:${annotation.id}`;
    if (!seenKeys.has(compositeKey)) {
      seenKeys.add(compositeKey);
      deduplicated.push(annotation);
    } else {
      Logger.warn("Canvas validation", "Duplicate annotation found", {
        compositeKey,
        elementId: annotation.elementId,
      });
    }
  }

  return deduplicated;
}

/**
 * Deduplicate string arrays using the utility function.
 */
function _deduplicateStringArrays(arrays: string[][]): string[][] {
  // Use deduplicateArray for string deduplication within arrays
  const deduplicatedArrays: string[][] = [];

  for (const array of arrays) {
    const deduplicatedArray = deduplicateArray(array);
    deduplicatedArrays.push(deduplicatedArray);
  }

  return deduplicatedArrays;
}

/**
 * Deduplicate annotation tags using the utility function.
 */
export function deduplicateAnnotationTags(tags: string[]): string[] {
  // Use deduplicateArray for tag deduplication
  return deduplicateArray(tags);
}

/**
 * Compare two annotations for equality using deep comparison.
 */
export function compareAnnotations(
  a: Annotation,
  b: Annotation
): boolean {
  // Use compareObjects for deep comparison
  return compareObjects(a, b);
}

/**
 * Compare two string arrays for equality.
 */
export function compareStringArrays(
  a: string[],
  b: string[]
): boolean {
  // Use the imported compareStringArrays utility
  return compareStringArraysUtil(a, b);
}

/**
 * Compare two annotation arrays for equality.
 * Arrays are sorted by ID before comparison for consistency.
 */
export function compareAnnotationArrays(
  a: Annotation[],
  b: Annotation[]
): boolean {
  if (a.length !== b.length) return false;

  // Sort both arrays by ID for consistent comparison
  const sortedA = [...a].sort((x, y) => x.id - y.id);
  const sortedB = [...b].sort((x, y) => x.id - y.id);

  // Compare each annotation
  for (let i = 0; i < sortedA.length; i++) {
    if (!compareObjects(sortedA[i], sortedB[i])) {
      return false;
    }
  }

  return true;
}

