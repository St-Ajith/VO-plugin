// ============================================================================
// VALIDATION SERVICE - Annotation data validation and sanitization
// ============================================================================

import { Annotation, DataValidationResult } from "../types";
import { Logger } from "../utils/logger";
import { cloneObject } from "@create-figma-plugin/utilities";

export class ValidationService {
  /**
   * Validate annotation data structure and content
   */
  validateAnnotationData(annotation: Annotation): DataValidationResult {
    try {
      // Use cloneObject to create a safe copy for validation
      const safeAnnotation = cloneObject(annotation);

      // Basic structure validation
      if (!safeAnnotation || typeof safeAnnotation !== "object") {
        return {
          isValid: false,
          errors: ["Annotation must be a valid object"],
          data: null,
        };
      }

      const errors: string[] = [];

      // Required fields validation
      if (!safeAnnotation.id || typeof safeAnnotation.id !== "number") {
        errors.push("Invalid or missing annotation ID");
      }

      if (
        !safeAnnotation.elementId ||
        typeof safeAnnotation.elementId !== "string"
      ) {
        errors.push("Invalid or missing element ID");
      }

      if (
        !safeAnnotation.platform ||
        !["mobile", "web"].includes(safeAnnotation.platform)
      ) {
        errors.push('Invalid platform (must be "mobile" or "web")');
      }

      // Platform-specific data validation
      if (safeAnnotation.platform === "mobile") {
        if (!safeAnnotation.mobile) {
          errors.push("Missing mobile accessibility data");
        } else {
          // Validate mobile structure
          if (!safeAnnotation.mobile.ios || !safeAnnotation.mobile.android) {
            errors.push("Incomplete mobile platform data");
          }
        }
      } else if (safeAnnotation.platform === "web") {
        if (!safeAnnotation.web) {
          errors.push("Missing web accessibility data");
        }
      }

      // Timestamp validation
      if (
        safeAnnotation.createdAt &&
        typeof safeAnnotation.createdAt !== "number"
      ) {
        errors.push("Invalid createdAt timestamp");
      }

      if (
        safeAnnotation.updatedAt &&
        typeof safeAnnotation.updatedAt !== "number"
      ) {
        errors.push("Invalid updatedAt timestamp");
      }

      return {
        isValid: errors.length === 0,
        ...(errors.length > 0 && { errors }),
        data: safeAnnotation,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        errors: [`Validation error: ${errorMessage}`],
        data: null,
      };
    }
  }

  /**
   * Validate canvas annotation (simpler validation for canvas-sourced data)
   */
  validateCanvasAnnotation(annotation: Annotation): boolean {
    try {
      // Basic structure validation
      if (!annotation || typeof annotation !== "object") {
        Logger.warn("Canvas validation", "Annotation is not an object", {
          annotation,
        });
        return false;
      }

      if (!annotation.id || typeof annotation.id !== "number") {
        Logger.warn("Canvas validation", "Invalid annotation ID", {
          id: annotation.id,
        });
        return false;
      }

      if (!annotation.elementId || typeof annotation.elementId !== "string") {
        Logger.warn("Canvas validation", "Invalid element ID", {
          elementId: annotation.elementId,
        });
        return false;
      }

      if (
        !annotation.platform ||
        !["mobile", "web"].includes(annotation.platform)
      ) {
        Logger.warn("Canvas validation", "Invalid platform", {
          platform: annotation.platform,
        });
        return false;
      }

      // Platform-specific validation
      if (annotation.platform === "mobile" && !annotation.mobile) {
        Logger.warn(
          "Canvas validation",
          "Missing mobile data for mobile platform"
        );
        return false;
      }

      if (annotation.platform === "web" && !annotation.web) {
        Logger.warn("Canvas validation", "Missing web data for web platform");
        return false;
      }

      return true;
    } catch (error) {
      Logger.error("Canvas validation", error);
      return false;
    }
  }

  /**
   * Validate annotation update (merges updates with current data and validates)
   */
  validateAnnotationUpdate(
    current: Annotation,
    updates: Partial<Annotation>
  ): DataValidationResult {
    try {
      // Create a safe working copy
      const workingCopy = cloneObject(current);

      // Apply updates
      Object.assign(workingCopy, updates);

      // Validate the merged result
      return this.validateAnnotationData(workingCopy);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        errors: [`Update validation error: ${errorMessage}`],
        data: null,
      };
    }
  }

  /**
   * Validate and clean canvas annotations (batch validation with deduplication)
   */
  validateAndCleanCanvasAnnotations(annotations: Annotation[]): Annotation[] {
    Logger.debug(
      "Canvas validation",
      `Validating ${annotations.length} annotations`
    );

    // Filter out invalid annotations
    const validAnnotations = annotations.filter((ann) =>
      this.validateCanvasAnnotation(ann)
    );

    // Deduplicate by composite key (frameId:id) since IDs are frame-scoped
    const keyMap = new Map<string, Annotation>();
    for (const ann of validAnnotations) {
      const compositeKey = `${ann.frameId}:${ann.id}`;
      if (!keyMap.has(compositeKey)) {
        keyMap.set(compositeKey, ann);
      }
    }
    const deduplicatedAnnotations = Array.from(keyMap.values());

    // Clone objects to prevent external mutations
    const cleanedAnnotations = deduplicatedAnnotations.map((ann) =>
      cloneObject(ann)
    );

    Logger.debug(
      "Canvas validation",
      `Validation complete: ${annotations.length} → ${cleanedAnnotations.length}`
    );

    return cleanedAnnotations;
  }
}
