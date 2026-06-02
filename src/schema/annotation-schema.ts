// ============================================================================
// ANNOTATION SCHEMA - Valibot schemas for runtime validation
// ============================================================================
// This module provides runtime validation for annotation data using Valibot.
// Used for validating IPC payloads and ensuring data integrity.
// ============================================================================

import * as v from "valibot";
import type { Annotation } from "../types";
import { Logger } from "../utils/logger";

// ============================================================================
// MOBILE PLATFORM SCHEMAS
// ============================================================================

const MobilePlatformDataSchema = v.object({
  label: v.string(),
  value: v.string(),
  trait: v.string(),
  hint: v.string(),
});

const MobileAnnotationSchema = v.object({
  ios: MobilePlatformDataSchema,
  android: MobilePlatformDataSchema,
});

// ============================================================================
// WEB PLATFORM SCHEMA
// ============================================================================

const WebAnnotationSchema = v.object({
  ariaLabel: v.string(),
  role: v.string(),
  ariaDescribedBy: v.string(),
  tabIndex: v.string(),
});

// ============================================================================
// ANNOTATION SCHEMA
// ============================================================================

export const AnnotationSchema = v.object({
  id: v.number(),
  frameId: v.string(),
  frameName: v.string(),
  pageId: v.string(),
  pageName: v.string(),
  platform: v.union([v.literal("mobile"), v.literal("web")]),
  elementId: v.string(),
  elementName: v.string(),
  voicedPreview: v.string(),
  targetElementId: v.nullable(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  mobile: v.optional(MobileAnnotationSchema),
  web: v.optional(WebAnnotationSchema),
});

// ============================================================================
// PARTIAL ANNOTATION SCHEMA (for updates)
// ============================================================================

export const PartialAnnotationSchema = v.partial(
  v.object({
    id: v.number(),
    frameId: v.string(),
    frameName: v.string(),
    pageId: v.string(),
    pageName: v.string(),
    platform: v.union([v.literal("mobile"), v.literal("web")]),
    elementId: v.string(),
    elementName: v.string(),
    voicedPreview: v.string(),
    targetElementId: v.nullable(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    mobile: MobileAnnotationSchema,
    web: WebAnnotationSchema,
  })
);

// ============================================================================
// IPC MESSAGE PAYLOAD SCHEMAS
// ============================================================================

export const SaveDataPayloadSchema = v.object({
  annotation: AnnotationSchema,
  requestId: v.optional(v.string()),
});

export const DeleteDataPayloadSchema = v.object({
  annotationId: v.number(),
  frameId: v.string(),
  elementId: v.string(),
  requestId: v.optional(v.string()),
});

export const UpdateAnnotationsPayloadSchema = v.object({
  annotations: v.array(AnnotationSchema),
});

// ============================================================================
// VALIDATION RESULT TYPE
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate a single annotation
 * Returns validated data with unknown keys stripped
 */
export function validateAnnotation(
  data: unknown
): ValidationResult<Annotation> {
  try {
    const result = v.safeParse(AnnotationSchema, data);
    if (result.success) {
      return {
        success: true,
        data: result.output as Annotation,
      };
    } else {
      const errors = result.issues.map((issue) => {
        const path = issue.path?.map((p) => p.key).join(".") || "root";
        return `${path}: ${issue.message}`;
      });
      Logger.debug("Annotation validation", "Validation failed", { errors });
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    Logger.error("Annotation validation", "Unexpected validation error", error);
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown validation error"],
    };
  }
}

/**
 * Validate an array of annotations
 * Returns only valid annotations, logging any invalid ones
 */
export function validateAnnotations(
  data: unknown[]
): { valid: Annotation[]; invalidCount: number } {
  const valid: Annotation[] = [];
  let invalidCount = 0;

  for (const item of data) {
    const result = validateAnnotation(item);
    if (result.success && result.data) {
      valid.push(result.data);
    } else {
      invalidCount++;
      Logger.warn("Annotation validation", "Invalid annotation in array", {
        item,
        errors: result.errors,
      });
    }
  }

  if (invalidCount > 0) {
    Logger.info("Annotation validation", "Filtered invalid annotations", {
      valid: valid.length,
      invalid: invalidCount,
    });
  }

  return { valid, invalidCount };
}

/**
 * Validate a partial annotation (for updates)
 */
export function validatePartialAnnotation(
  data: unknown
): ValidationResult<Partial<Annotation>> {
  try {
    const result = v.safeParse(PartialAnnotationSchema, data);
    if (result.success) {
      return {
        success: true,
        data: result.output as Partial<Annotation>,
      };
    } else {
      const errors = result.issues.map((issue) => {
        const path = issue.path?.map((p) => p.key).join(".") || "root";
        return `${path}: ${issue.message}`;
      });
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown validation error"],
    };
  }
}

/**
 * Validate save-data IPC payload
 */
export function validateSaveDataPayload(
  data: unknown
): ValidationResult<{ annotation: Annotation; requestId?: string }> {
  try {
    const result = v.safeParse(SaveDataPayloadSchema, data);
    if (result.success) {
      return {
        success: true,
        data: result.output as { annotation: Annotation; requestId?: string },
      };
    } else {
      const errors = result.issues.map((issue) => {
        const path = issue.path?.map((p) => p.key).join(".") || "root";
        return `${path}: ${issue.message}`;
      });
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown validation error"],
    };
  }
}

/**
 * Validate delete-data IPC payload
 */
export function validateDeleteDataPayload(
  data: unknown
): ValidationResult<{ annotationId: number; frameId: string; elementId: string; requestId?: string }> {
  try {
    const result = v.safeParse(DeleteDataPayloadSchema, data);
    if (result.success) {
      return {
        success: true,
        data: result.output as { annotationId: number; frameId: string; elementId: string; requestId?: string },
      };
    } else {
      const errors = result.issues.map((issue) => {
        const path = issue.path?.map((p) => p.key).join(".") || "root";
        return `${path}: ${issue.message}`;
      });
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    return {
      success: false,
      errors: [error instanceof Error ? error.message : "Unknown validation error"],
    };
  }
}

