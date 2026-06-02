// ============================================================================
// ANNOTATION DEDUPLICATION TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import {
  removeDuplicateAnnotations,
  deduplicateCanvasAnnotations,
  deduplicateAnnotationTags,
  compareAnnotations,
  compareStringArrays,
  compareAnnotationArrays,
} from "../../utils/annotation-deduplication";
import { ValidationService } from "../../services/validation";
import { createMobileAnnotation, createWebAnnotation } from "../fixtures/annotations";
// Annotation type not used in this test file (keep import removed)
import { mockConsole } from "../utils/test-helpers";

describe("Annotation Deduplication Utilities", () => {
  let validation: ValidationService;

  beforeEach(() => {
    validation = new ValidationService();
  });

  // ==========================================================================
  // removeDuplicateAnnotations tests
  // ==========================================================================

  describe("removeDuplicateAnnotations", () => {
    it("should return empty array for empty input", () => {
      const consoleMock = mockConsole();
      const result = removeDuplicateAnnotations([], validation);
      expect(result).toEqual([]);
      consoleMock.restore();
    });

    it("should keep single annotation unchanged", () => {
      const consoleMock = mockConsole();
      const annotations = [createMobileAnnotation({ id: 1 })];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.id).toBe(1);
      consoleMock.restore();
    });

    it("should remove duplicate IDs keeping first occurrence", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, elementId: "element-1", voicedPreview: "First" }),
        createMobileAnnotation({ id: 1, elementId: "element-1-dup", voicedPreview: "Duplicate" }),
        createMobileAnnotation({ id: 2, elementId: "element-2" }),
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual([1, 2]);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.voicedPreview).toBe("First");
      consoleMock.restore();
    });

    it("should remove content duplicates (same element, same platform, same content)", () => {
      const consoleMock = mockConsole();
      const base = createMobileAnnotation({ 
        id: 1, 
        elementId: "element-1",
        voicedPreview: "Same" 
      });
      const annotations = [
        base,
        createMobileAnnotation({ 
          id: 2, 
          elementId: "element-1", // Same element
          voicedPreview: "Same" 
        }),
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      // Should remove duplicates by content
      expect(result).toHaveLength(1);
      consoleMock.restore();
    });

    it("should keep annotations with different content", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, elementId: "element-1" }),
        createMobileAnnotation({ id: 2, elementId: "element-2" }),
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(2);
      consoleMock.restore();
    });

    it("should filter out invalid annotations", () => {
      const consoleMock = mockConsole();
      const validAnnotation = createMobileAnnotation({ id: 1 });
      const invalidAnnotation = {
        id: 2,
        frameId: "frame-1",
        frameName: "Test Frame",
        pageId: "page-1",
        pageName: "Test Page",
        elementId: "", // Invalid - empty elementId
        elementName: "Test Element",
        platform: "mobile" as const,
        voicedPreview: "",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mobile: {
          ios: { label: "", value: "", trait: "Button", hint: "" },
          android: { label: "", value: "", trait: "Button", hint: "" },
        },
      };
      const annotations = [validAnnotation, invalidAnnotation];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.id).toBe(1);
      consoleMock.restore();
    });

    // ========================================================================
    // Multi-frame deduplication tests (fix for cross-frame ID collision)
    // ========================================================================

    it("should preserve annotations with same numeric ID across different frames", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, frameId: "frame-A", frameName: "Frame A", elementId: "element-A1" }),
        createMobileAnnotation({ id: 1, frameId: "frame-B", frameName: "Frame B", elementId: "element-B1" }),
        createMobileAnnotation({ id: 1, frameId: "frame-C", frameName: "Frame C", elementId: "element-C1" }),
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(3);
      expect(result.map((a) => a.frameId)).toEqual(["frame-A", "frame-B", "frame-C"]);
      consoleMock.restore();
    });

    it("should preserve annotations with same content across different frames", () => {
      const consoleMock = mockConsole();
      // Same content but different frameId - should NOT be deduplicated
      const annotations = [
        createMobileAnnotation({ 
          id: 1, 
          frameId: "frame-A", 
          elementId: "element-A1",
          mobile: {
            ios: { label: "Button", value: "", trait: "Button", hint: "" },
            android: { label: "Button", value: "", trait: "Button", hint: "" },
          },
        }),
        createMobileAnnotation({ 
          id: 1, 
          frameId: "frame-B", 
          elementId: "element-B1", // Different element but same content
          mobile: {
            ios: { label: "Button", value: "", trait: "Button", hint: "" },
            android: { label: "Button", value: "", trait: "Button", hint: "" },
          },
        }),
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(2);
      consoleMock.restore();
    });

    it("should still deduplicate true duplicates with same frameId and id", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, frameId: "frame-A", elementId: "element-1", voicedPreview: "First" }),
        createMobileAnnotation({ id: 1, frameId: "frame-A", elementId: "element-1", voicedPreview: "Duplicate" }), // True duplicate
        createMobileAnnotation({ id: 2, frameId: "frame-A", elementId: "element-2" }), // Different element
      ];
      const result = removeDuplicateAnnotations(annotations, validation);
      expect(result).toHaveLength(2);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.voicedPreview).toBe("First");
      consoleMock.restore();
    });
  });

  // ==========================================================================
  // deduplicateCanvasAnnotations tests
  // ==========================================================================

  describe("deduplicateCanvasAnnotations", () => {
    it("should return empty array for empty input", () => {
      const consoleMock = mockConsole();
      const result = deduplicateCanvasAnnotations([]);
      expect(result).toEqual([]);
      consoleMock.restore();
    });

    it("should remove duplicate IDs keeping first occurrence", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, voicedPreview: "First" }),
        createMobileAnnotation({ id: 1, voicedPreview: "Duplicate" }),
        createMobileAnnotation({ id: 2 }),
      ];
      const result = deduplicateCanvasAnnotations(annotations);
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual([1, 2]);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.voicedPreview).toBe("First");
      consoleMock.restore();
    });

    it("should preserve order of unique annotations", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 3 }),
        createMobileAnnotation({ id: 1 }),
        createMobileAnnotation({ id: 2 }),
      ];
      const result = deduplicateCanvasAnnotations(annotations);
      expect(result.map((a) => a.id)).toEqual([3, 1, 2]);
      consoleMock.restore();
    });

    it("should preserve annotations with same ID across different frames", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, frameId: "frame-A" }),
        createMobileAnnotation({ id: 1, frameId: "frame-B" }),
        createMobileAnnotation({ id: 2, frameId: "frame-A" }),
      ];
      const result = deduplicateCanvasAnnotations(annotations);
      expect(result).toHaveLength(3);
      expect(result.map((a) => `${a.frameId}:${a.id}`)).toEqual([
        "frame-A:1",
        "frame-B:1",
        "frame-A:2",
      ]);
      consoleMock.restore();
    });

    it("should deduplicate true duplicates with same frameId and id", () => {
      const consoleMock = mockConsole();
      const annotations = [
        createMobileAnnotation({ id: 1, frameId: "frame-A", voicedPreview: "First" }),
        createMobileAnnotation({ id: 1, frameId: "frame-A", voicedPreview: "Duplicate" }),
      ];
      const result = deduplicateCanvasAnnotations(annotations);
      expect(result).toHaveLength(1);
      const firstResult = result[0]!;
      expect(firstResult).toBeDefined();
      expect(firstResult.voicedPreview).toBe("First");
      consoleMock.restore();
    });
  });

  // ==========================================================================
  // deduplicateAnnotationTags tests
  // ==========================================================================

  describe("deduplicateAnnotationTags", () => {
    it("should return empty array for empty input", () => {
      const result = deduplicateAnnotationTags([]);
      expect(result).toEqual([]);
    });

    it("should remove duplicate tags", () => {
      const tags = ["button", "interactive", "button", "label"];
      const result = deduplicateAnnotationTags(tags);
      expect(result).toHaveLength(3);
      expect(result).toContain("button");
      expect(result).toContain("interactive");
      expect(result).toContain("label");
    });

    it("should preserve order of first occurrences", () => {
      const tags = ["a", "b", "a", "c", "b"];
      const result = deduplicateAnnotationTags(tags);
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  // ==========================================================================
  // compareAnnotations tests
  // ==========================================================================

  describe("compareAnnotations", () => {
    it("should return true for identical annotations", () => {
      const annotation = createMobileAnnotation({ id: 1 });
      expect(compareAnnotations(annotation, annotation)).toBe(true);
    });

    it("should return true for deep equal annotations", () => {
      const now = Date.now();
      const a = createMobileAnnotation({ 
        id: 1, 
        voicedPreview: "Test",
        createdAt: now,
        updatedAt: now,
        mobile: {
          ios: { label: "Label", value: "", trait: "Button", hint: "" },
          android: { label: "Label", value: "", trait: "Button", hint: "" },
        },
      });
      const b = createMobileAnnotation({ 
        id: 1, 
        voicedPreview: "Test",
        createdAt: now,
        updatedAt: now,
        mobile: {
          ios: { label: "Label", value: "", trait: "Button", hint: "" },
          android: { label: "Label", value: "", trait: "Button", hint: "" },
        },
      });
      expect(compareAnnotations(a, b)).toBe(true);
    });

    it("should return false for different IDs", () => {
      const a = createMobileAnnotation({ id: 1 });
      const b = createMobileAnnotation({ id: 2 });
      expect(compareAnnotations(a, b)).toBe(false);
    });

    it("should return false for different content", () => {
      const a = createMobileAnnotation({ id: 1, voicedPreview: "A" });
      const b = createMobileAnnotation({ id: 1, voicedPreview: "B" });
      expect(compareAnnotations(a, b)).toBe(false);
    });

    it("should return false for different platforms", () => {
      const a = createMobileAnnotation({ id: 1 });
      const b = createWebAnnotation({ id: 1 });
      expect(compareAnnotations(a, b)).toBe(false);
    });
  });

  // ==========================================================================
  // compareStringArrays tests
  // ==========================================================================

  describe("compareStringArrays", () => {
    it("should return true for identical arrays", () => {
      expect(compareStringArrays(["a", "b", "c"], ["a", "b", "c"])).toBe(true);
    });

    it("should return true for empty arrays", () => {
      expect(compareStringArrays([], [])).toBe(true);
    });

    it("should return false for different lengths", () => {
      expect(compareStringArrays(["a", "b"], ["a", "b", "c"])).toBe(false);
    });

    it("should return false for different content", () => {
      expect(compareStringArrays(["a", "b"], ["a", "c"])).toBe(false);
    });

    it("should return false for different order", () => {
      expect(compareStringArrays(["a", "b"], ["b", "a"])).toBe(false);
    });
  });

  // ==========================================================================
  // compareAnnotationArrays tests
  // ==========================================================================

  describe("compareAnnotationArrays", () => {
    it("should return true for empty arrays", () => {
      expect(compareAnnotationArrays([], [])).toBe(true);
    });

    it("should return true for identical arrays", () => {
      const a = [createMobileAnnotation({ id: 1 }), createMobileAnnotation({ id: 2 })];
      const b = [createMobileAnnotation({ id: 1 }), createMobileAnnotation({ id: 2 })];
      expect(compareAnnotationArrays(a, b)).toBe(true);
    });

    it("should return true for same content in different order", () => {
      const a = [createMobileAnnotation({ id: 2 }), createMobileAnnotation({ id: 1 })];
      const b = [createMobileAnnotation({ id: 1 }), createMobileAnnotation({ id: 2 })];
      // Arrays are sorted by ID before comparison
      expect(compareAnnotationArrays(a, b)).toBe(true);
    });

    it("should return false for different lengths", () => {
      const a = [createMobileAnnotation({ id: 1 })];
      const b = [createMobileAnnotation({ id: 1 }), createMobileAnnotation({ id: 2 })];
      expect(compareAnnotationArrays(a, b)).toBe(false);
    });

    it("should return false for different content", () => {
      const a = [createMobileAnnotation({ id: 1, voicedPreview: "A" })];
      const b = [createMobileAnnotation({ id: 1, voicedPreview: "B" })];
      expect(compareAnnotationArrays(a, b)).toBe(false);
    });
  });
});
