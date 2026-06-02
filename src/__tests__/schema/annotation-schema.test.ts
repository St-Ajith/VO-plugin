import { describe, it, expect, vi } from "vitest";
import {
  validateAnnotation,
  validateAnnotations,
  validatePartialAnnotation,
  validateSaveDataPayload,
  validateDeleteDataPayload,
} from "../../schema/annotation-schema";
import type { Annotation } from "../../types";

// Mock the logger to avoid console output during tests
vi.mock("../../utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("annotation-schema", () => {
  const validAnnotation: Annotation = {
    id: 1,
    frameId: "frame-123",
    frameName: "Test Frame",
    pageId: "page-456",
    pageName: "Test Page",
    platform: "mobile",
    elementId: "elem-789",
    elementName: "Test Element",
    voicedPreview: "Test preview",
    targetElementId: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    mobile: {
      ios: { label: "iOS Label", value: "iOS Value", trait: "button", hint: "iOS Hint" },
      android: { label: "Android Label", value: "Android Value", trait: "button", hint: "Android Hint" },
    },
    web: {
      ariaLabel: "Test Label",
      role: "button",
      ariaDescribedBy: "description",
      tabIndex: "0",
    },
  };

  describe("validateAnnotation", () => {
    it("should validate a correct annotation", () => {
      const result = validateAnnotation(validAnnotation);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(validAnnotation);
    });

    it("should reject annotation with missing required fields", () => {
      const invalidAnnotation = {
        id: 1,
        // Missing frameId, frameName, etc.
      };
      const result = validateAnnotation(invalidAnnotation);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should reject annotation with invalid platform", () => {
      const invalidAnnotation = {
        ...validAnnotation,
        platform: "invalid" as Annotation["platform"],
      };
      const result = validateAnnotation(invalidAnnotation);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject annotation with wrong id type", () => {
      const invalidAnnotation = {
        ...validAnnotation,
        id: "not-a-number" as unknown as number,
      };
      const result = validateAnnotation(invalidAnnotation);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should accept annotation with web platform", () => {
      const webAnnotation: Annotation = {
        ...validAnnotation,
        platform: "web",
      };
      const result = validateAnnotation(webAnnotation);
      expect(result.success).toBe(true);
    });

    it("should accept annotation without optional mobile/web fields", () => {
      const minimalAnnotation: Annotation = {
        id: 1,
        frameId: "frame-123",
        frameName: "Test Frame",
        pageId: "page-456",
        pageName: "Test Page",
        platform: "mobile",
        elementId: "elem-789",
        elementName: "Test Element",
        voicedPreview: "Test preview",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const result = validateAnnotation(minimalAnnotation);
      expect(result.success).toBe(true);
    });
  });

  describe("validateAnnotations", () => {
    it("should validate an array of correct annotations", () => {
      const result = validateAnnotations([validAnnotation, validAnnotation]);
      expect(result.valid.length).toBe(2);
      expect(result.invalidCount).toBe(0);
    });

    it("should filter out invalid annotations and count them", () => {
      const invalidAnnotation = { id: "invalid" };
      const result = validateAnnotations([validAnnotation, invalidAnnotation, validAnnotation]);
      expect(result.valid.length).toBe(2);
      expect(result.invalidCount).toBe(1);
    });

    it("should return empty valid array for all invalid input", () => {
      const result = validateAnnotations([{ invalid: true }, { also: "invalid" }]);
      expect(result.valid.length).toBe(0);
      expect(result.invalidCount).toBe(2);
    });

    it("should handle empty array", () => {
      const result = validateAnnotations([]);
      expect(result.valid.length).toBe(0);
      expect(result.invalidCount).toBe(0);
    });
  });

  describe("validatePartialAnnotation", () => {
    it("should validate a partial annotation for updates", () => {
      const partial = {
        id: 1,
        voicedPreview: "Updated preview",
      };
      const result = validatePartialAnnotation(partial);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(partial);
    });

    it("should accept empty object", () => {
      const result = validatePartialAnnotation({});
      expect(result.success).toBe(true);
    });

    it("should reject invalid field types in partial", () => {
      const invalid = {
        id: "not-a-number",
      };
      const result = validatePartialAnnotation(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("validateSaveDataPayload", () => {
    it("should validate a correct save-data payload", () => {
      const payload = {
        annotation: validAnnotation,
        requestId: "req-123",
      };
      const result = validateSaveDataPayload(payload);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it("should validate payload without requestId", () => {
      const payload = {
        annotation: validAnnotation,
      };
      const result = validateSaveDataPayload(payload);
      expect(result.success).toBe(true);
    });

    it("should reject payload with invalid annotation", () => {
      const payload = {
        annotation: { id: "invalid" },
        requestId: "req-123",
      };
      const result = validateSaveDataPayload(payload);
      expect(result.success).toBe(false);
    });

    it("should reject payload without annotation", () => {
      const payload = {
        requestId: "req-123",
      };
      const result = validateSaveDataPayload(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("validateDeleteDataPayload", () => {
    it("should validate a correct delete-data payload", () => {
      const payload = {
        annotationId: 1,
        frameId: "frame-123",
        elementId: "elem-456",
        requestId: "req-789",
      };
      const result = validateDeleteDataPayload(payload);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(payload);
    });

    it("should validate payload without requestId", () => {
      const payload = {
        annotationId: 1,
        frameId: "frame-123",
        elementId: "elem-456",
      };
      const result = validateDeleteDataPayload(payload);
      expect(result.success).toBe(true);
    });

    it("should reject payload with wrong annotationId type", () => {
      const payload = {
        annotationId: "not-a-number",
        frameId: "frame-123",
        elementId: "elem-456",
      };
      const result = validateDeleteDataPayload(payload);
      expect(result.success).toBe(false);
    });

    it("should reject payload missing required fields", () => {
      const payload = {
        annotationId: 1,
        // Missing frameId and elementId
      };
      const result = validateDeleteDataPayload(payload);
      expect(result.success).toBe(false);
    });
  });
});

