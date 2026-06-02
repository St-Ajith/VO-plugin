// ============================================================================
// VALIDATION SERVICE TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { ValidationService } from "../../services/validation";
import {
  createMobileAnnotation,
  createWebAnnotation,
  createInvalidAnnotation,
  createDuplicateAnnotations,
} from "../fixtures/annotations";
import { mockConsole } from "../utils/test-helpers";

describe("ValidationService", () => {
  let validation: ValidationService;

  beforeEach(() => {
    validation = new ValidationService();
  });

  // ==========================================================================
  // validateCanvasAnnotation tests
  // ==========================================================================

  describe("validateCanvasAnnotation", () => {
    it("should return true for valid mobile annotation", () => {
      const annotation = createMobileAnnotation();
      expect(validation.validateCanvasAnnotation(annotation)).toBe(true);
    });

    it("should return true for valid web annotation", () => {
      const annotation = createWebAnnotation();
      expect(validation.validateCanvasAnnotation(annotation)).toBe(true);
    });

    it("should return false for null annotation", () => {
      const consoleMock = mockConsole();
      expect(validation.validateCanvasAnnotation(null as never)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation without id", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      delete annotation.id;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation with non-number id", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      annotation.id = "not-a-number";
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation without elementId", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      delete annotation.elementId;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation with non-string elementId", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      annotation.elementId = 123;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation without platform", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      delete annotation.platform;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for annotation with invalid platform", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      annotation.platform = "invalid";
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for mobile annotation without mobile data", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation();
      delete annotation.mobile;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });

    it("should return false for web annotation without web data", () => {
      const consoleMock = mockConsole();
      const annotation = createWebAnnotation();
      delete annotation.web;
      expect(validation.validateCanvasAnnotation(annotation)).toBe(false);
      consoleMock.restore();
    });
  });

  // ==========================================================================
  // validateAnnotationData tests
  // ==========================================================================

  describe("validateAnnotationData", () => {
    it("should return valid result for valid mobile annotation", () => {
      const annotation = createMobileAnnotation();
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data).not.toBeNull();
    });

    it("should return valid result for valid web annotation", () => {
      const annotation = createWebAnnotation();
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.data).not.toBeNull();
    });

    it("should return invalid result for missing id", () => {
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      delete annotation.id;
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid or missing annotation ID");
    });

    it("should return invalid result for missing elementId", () => {
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      delete annotation.elementId;
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Invalid or missing element ID");
    });

    it("should return invalid result for invalid platform", () => {
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      annotation.platform = "desktop";
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid platform (must be "mobile" or "web")');
    });

    it("should return invalid result for mobile platform without mobile data", () => {
      const annotation = createMobileAnnotation();
      delete annotation.mobile;
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing mobile accessibility data");
    });

    it("should return invalid result for incomplete mobile data", () => {
      const annotation = createMobileAnnotation();
      // @ts-expect-error - testing invalid input
      annotation.mobile = { ios: annotation.mobile!.ios };
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Incomplete mobile platform data");
    });

    it("should return invalid result for web platform without web data", () => {
      const annotation = createWebAnnotation();
      delete annotation.web;
      const result = validation.validateAnnotationData(annotation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Missing web accessibility data");
    });

    it("should collect multiple errors", () => {
      const invalidAnnotation = createInvalidAnnotation();
      const result = validation.validateAnnotationData(invalidAnnotation as never);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(1);
    });
  });

  // ==========================================================================
  // validateAndCleanCanvasAnnotations tests
  // ==========================================================================

  describe("validateAndCleanCanvasAnnotations", () => {
    it("should return empty array for empty input", () => {
      const consoleMock = mockConsole();
      const result = validation.validateAndCleanCanvasAnnotations([]);
      expect(result).toEqual([]);
      consoleMock.restore();
    });

    it("should filter out invalid annotations", () => {
      const consoleMock = mockConsole();
      const validAnnotation = createMobileAnnotation();
      const invalidAnnotation = createMobileAnnotation({ id: 2 });
      // @ts-expect-error - testing invalid input
      delete invalidAnnotation.elementId;
      
      const result = validation.validateAndCleanCanvasAnnotations([
        validAnnotation,
        invalidAnnotation,
      ]);
      
      expect(result).toHaveLength(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.id).toBe(validAnnotation.id);
      consoleMock.restore();
    });

    it("should remove duplicate annotations by ID", () => {
      const consoleMock = mockConsole();
      const duplicates = createDuplicateAnnotations();
      
      const result = validation.validateAndCleanCanvasAnnotations(duplicates);
      
      // Should have unique IDs only
      const ids = result.map((a) => a.id);
      const uniqueIds = Array.from(new Set(ids));
      expect(ids).toEqual(uniqueIds);
      consoleMock.restore();
    });

    it("should preserve valid annotations", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1 }),
        createMobileAnnotation({ id: 2, elementId: "element-2" }),
        createWebAnnotation({ id: 3, elementId: "element-3" }),
      ];
      
      const result = validation.validateAndCleanCanvasAnnotations(annotations);
      
      expect(result).toHaveLength(3);
      consoleMock.restore();
    });

    it("should clone annotations to prevent mutation", () => {
      const consoleMock = mockConsole();
      const original = createMobileAnnotation();
      const result = validation.validateAndCleanCanvasAnnotations([original]);
      
      // Modify the result
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      if (firstResult) {
        firstResult.voicedPreview = "Modified";
      }
      
      // Original should be unchanged
      expect(original.voicedPreview).not.toBe("Modified");
      consoleMock.restore();
    });
  });

  // ==========================================================================
  // validateAnnotationUpdate tests
  // ==========================================================================

  describe("validateAnnotationUpdate", () => {
    it("should validate valid update", () => {
      const current = createMobileAnnotation();
      const updates = { voicedPreview: "Updated preview" };
      
      const result = validation.validateAnnotationUpdate(current, updates);
      
      expect(result.isValid).toBe(true);
      expect(result.data?.voicedPreview).toBe("Updated preview");
    });

    it("should reject update that would make annotation invalid", () => {
      const current = createMobileAnnotation();
      // Cast to test with invalid platform value
      const updates = { platform: "invalid" as "mobile" | "web" };
      
      const result = validation.validateAnnotationUpdate(current, updates);
      
      expect(result.isValid).toBe(false);
    });

    it("should merge nested updates", () => {
      const current = createMobileAnnotation();
      const updates = {
        mobile: {
          ios: { label: "New Label", value: "", trait: "Button", hint: "" },
          android: current.mobile!.android,
        },
      };
      
      const result = validation.validateAnnotationUpdate(current, updates);
      
      expect(result.isValid).toBe(true);
      expect(result.data?.mobile?.ios.label).toBe("New Label");
    });
  });
});
