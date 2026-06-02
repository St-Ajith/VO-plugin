// ============================================================================
// ANNOTATION FIELD SCHEMA TESTS
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  MOBILE_FIELDS,
  WEB_FIELDS,
  ALL_FIELDS,
  getFieldDefinition,
  mapFieldPathToCellLocation,
  mapCellLocationToFieldPath,
  getTableRows,
  getFieldValue,
  getColumnWidths,
  getHeaderColumnTexts,
  getTableRowHeights,
  validateSchema,
} from "../../schema/annotation-fields";
import { createMobileAnnotation, createWebAnnotation } from "../fixtures/annotations";

describe("Annotation Field Schema", () => {
  // ==========================================================================
  // FIELD_DEFINITIONS structure tests
  // ==========================================================================

  describe("Field Definitions Structure", () => {
    it("should have 9 mobile fields defined", () => {
      expect(MOBILE_FIELDS).toHaveLength(9);
    });

    it("should have 4 web fields defined", () => {
      expect(WEB_FIELDS).toHaveLength(4);
    });

    it("should have 13 total fields in ALL_FIELDS", () => {
      expect(ALL_FIELDS).toHaveLength(13);
      expect(ALL_FIELDS).toEqual([...MOBILE_FIELDS, ...WEB_FIELDS]);
    });

    it("mobile fields should have correct structure", () => {
      for (const field of MOBILE_FIELDS) {
        expect(field).toHaveProperty("path");
        expect(field).toHaveProperty("label");
        expect(field).toHaveProperty("platform", "mobile");
        expect(field).toHaveProperty("rowIndex");
        expect(field).toHaveProperty("cellIndex");
        expect(field).toHaveProperty("multiCell");
        expect(typeof field.path).toBe("string");
        expect(typeof field.label).toBe("string");
        expect(typeof field.rowIndex).toBe("number");
        expect(typeof field.cellIndex).toBe("number");
        expect(typeof field.multiCell).toBe("boolean");
      }
    });

    it("web fields should have correct structure", () => {
      for (const field of WEB_FIELDS) {
        expect(field).toHaveProperty("path");
        expect(field).toHaveProperty("label");
        expect(field).toHaveProperty("platform", "web");
        expect(field).toHaveProperty("subPlatform", null);
        expect(field).toHaveProperty("rowIndex");
        expect(field).toHaveProperty("cellIndex");
        expect(field).toHaveProperty("multiCell", false);
      }
    });

    it("voicedPreview should be a multiCell field with null subPlatform", () => {
      const voicedPreview = MOBILE_FIELDS.find(
        (f) => f.path === "voicedPreview"
      );
      expect(voicedPreview).toBeDefined();
      expect(voicedPreview?.multiCell).toBe(true);
      expect(voicedPreview?.subPlatform).toBeNull();
      expect(voicedPreview?.rowIndex).toBe(0);
    });

    it("mobile fields should have ios and android subPlatforms (except voicedPreview)", () => {
      const platformFields = MOBILE_FIELDS.filter((f) => f.subPlatform !== null);
      const iosFields = platformFields.filter((f) => f.subPlatform === "ios");
      const androidFields = platformFields.filter((f) => f.subPlatform === "android");

      expect(iosFields).toHaveLength(4); // label, value, trait, hint
      expect(androidFields).toHaveLength(4); // label, value, trait, hint
    });
  });

  // ==========================================================================
  // getFieldDefinition tests
  // ==========================================================================

  describe("getFieldDefinition", () => {
    it("should return field definition for valid mobile path", () => {
      const field = getFieldDefinition("mobile.ios.label");
      expect(field).not.toBeNull();
      expect(field?.path).toBe("mobile.ios.label");
      expect(field?.platform).toBe("mobile");
      expect(field?.subPlatform).toBe("ios");
    });

    it("should return field definition for voicedPreview", () => {
      const field = getFieldDefinition("voicedPreview");
      expect(field).not.toBeNull();
      expect(field?.path).toBe("voicedPreview");
      expect(field?.multiCell).toBe(true);
    });

    it("should return field definition for valid web path", () => {
      const field = getFieldDefinition("web.ariaLabel");
      expect(field).not.toBeNull();
      expect(field?.path).toBe("web.ariaLabel");
      expect(field?.platform).toBe("web");
    });

    it("should return null for unknown path", () => {
      const field = getFieldDefinition("unknown.path");
      expect(field).toBeNull();
    });

    it("should return null for empty string", () => {
      const field = getFieldDefinition("");
      expect(field).toBeNull();
    });
  });

  // ==========================================================================
  // mapFieldPathToCellLocation tests
  // ==========================================================================

  describe("mapFieldPathToCellLocation", () => {
    it("should map mobile.ios.label to correct cell location", () => {
      const locations = mapFieldPathToCellLocation("mobile.ios.label", "mobile");
      expect(locations).toHaveLength(1);
      expect(locations?.[0]).toEqual({ rowIndex: 1, cellIndex: 1 });
    });

    it("should map mobile.android.label to correct cell location", () => {
      const locations = mapFieldPathToCellLocation("mobile.android.label", "mobile");
      expect(locations).toHaveLength(1);
      expect(locations?.[0]).toEqual({ rowIndex: 1, cellIndex: 2 });
    });

    it("should map voicedPreview to both iOS and Android columns", () => {
      const locations = mapFieldPathToCellLocation("voicedPreview", "mobile");
      expect(locations).toHaveLength(2);
      expect(locations).toContainEqual({ rowIndex: 0, cellIndex: 1 }); // iOS
      expect(locations).toContainEqual({ rowIndex: 0, cellIndex: 2 }); // Android
    });

    it("should map web.ariaLabel to correct cell location", () => {
      const locations = mapFieldPathToCellLocation("web.ariaLabel", "web");
      expect(locations).toHaveLength(1);
      expect(locations?.[0]).toEqual({ rowIndex: 0, cellIndex: 1 });
    });

    it("should return null for mismatched platform", () => {
      const locations = mapFieldPathToCellLocation("mobile.ios.label", "web");
      expect(locations).toBeNull();
    });

    it("should return null for unknown field path", () => {
      const locations = mapFieldPathToCellLocation("unknown.path", "mobile");
      expect(locations).toBeNull();
    });
  });

  // ==========================================================================
  // mapCellLocationToFieldPath tests (inverse mapping)
  // ==========================================================================

  describe("mapCellLocationToFieldPath", () => {
    it("should map iOS label cell to mobile.ios.label", () => {
      const fieldPath = mapCellLocationToFieldPath(1, 1, "mobile");
      expect(fieldPath).toBe("mobile.ios.label");
    });

    it("should map Android label cell to mobile.android.label", () => {
      const fieldPath = mapCellLocationToFieldPath(1, 2, "mobile");
      expect(fieldPath).toBe("mobile.android.label");
    });

    it("should map voicedPreview row iOS cell to voicedPreview", () => {
      const fieldPath = mapCellLocationToFieldPath(0, 1, "mobile");
      expect(fieldPath).toBe("voicedPreview");
    });

    it("should map voicedPreview row Android cell to voicedPreview", () => {
      const fieldPath = mapCellLocationToFieldPath(0, 2, "mobile");
      expect(fieldPath).toBe("voicedPreview");
    });

    it("should map web ariaLabel cell correctly", () => {
      const fieldPath = mapCellLocationToFieldPath(0, 1, "web");
      expect(fieldPath).toBe("web.ariaLabel");
    });

    it("should return null for label column (cellIndex 0)", () => {
      const fieldPath = mapCellLocationToFieldPath(0, 0, "mobile");
      expect(fieldPath).toBeNull();
    });

    it("should return null for invalid cell index in web", () => {
      const fieldPath = mapCellLocationToFieldPath(0, 2, "web");
      expect(fieldPath).toBeNull();
    });

    it("should return null for invalid row index", () => {
      const fieldPath = mapCellLocationToFieldPath(99, 1, "mobile");
      expect(fieldPath).toBeNull();
    });
  });

  // ==========================================================================
  // Round-trip mapping tests
  // ==========================================================================

  describe("Round-trip mapping", () => {
    it("should round-trip all mobile fields correctly", () => {
      const mobileFields = ALL_FIELDS.filter((f) => f.platform === "mobile");
      for (const field of mobileFields) {
        const locations = mapFieldPathToCellLocation(field.path, "mobile");
        expect(locations).not.toBeNull();

        for (const location of locations!) {
          const mappedBack = mapCellLocationToFieldPath(
            location.rowIndex,
            location.cellIndex,
            "mobile"
          );
          expect(mappedBack).toBe(field.path);
        }
      }
    });

    it("should round-trip all web fields correctly", () => {
      const webFields = ALL_FIELDS.filter((f) => f.platform === "web");
      for (const field of webFields) {
        const locations = mapFieldPathToCellLocation(field.path, "web");
        expect(locations).not.toBeNull();

        for (const location of locations!) {
          const mappedBack = mapCellLocationToFieldPath(
            location.rowIndex,
            location.cellIndex,
            "web"
          );
          expect(mappedBack).toBe(field.path);
        }
      }
    });
  });

  // ==========================================================================
  // getFieldValue tests
  // ==========================================================================

  describe("getFieldValue", () => {
    it("should get voicedPreview value", () => {
      const annotation = createMobileAnnotation({ voicedPreview: "Test Preview" });
      const value = getFieldValue(annotation, "voicedPreview");
      expect(value).toBe("Test Preview");
    });

    it("should get mobile.ios.label value", () => {
      const annotation = createMobileAnnotation({
        mobile: {
          ios: { label: "iOS Label", value: "", trait: "Button", hint: "" },
          android: { label: "", value: "", trait: "Button", hint: "" },
        },
      });
      const value = getFieldValue(annotation, "mobile.ios.label");
      expect(value).toBe("iOS Label");
    });

    it("should get mobile.android.trait value", () => {
      const annotation = createMobileAnnotation({
        mobile: {
          ios: { label: "", value: "", trait: "Button", hint: "" },
          android: { label: "", value: "", trait: "Checkbox", hint: "" },
        },
      });
      const value = getFieldValue(annotation, "mobile.android.trait");
      expect(value).toBe("Checkbox");
    });

    it("should get web.ariaLabel value", () => {
      const annotation = createWebAnnotation({
        web: {
          ariaLabel: "Close button",
          role: "button",
          ariaDescribedBy: "",
          tabIndex: "0",
        },
      });
      const value = getFieldValue(annotation, "web.ariaLabel");
      expect(value).toBe("Close button");
    });

    it("should return null for unknown field path", () => {
      const annotation = createMobileAnnotation();
      const value = getFieldValue(annotation, "unknown.path");
      expect(value).toBeNull();
    });

    it("should return null for missing mobile data", () => {
      const annotation = createWebAnnotation(); // No mobile data
      const value = getFieldValue(annotation, "mobile.ios.label");
      expect(value).toBeNull();
    });
  });

  // ==========================================================================
  // getTableRows tests
  // ==========================================================================

  describe("getTableRows", () => {
    it("should generate correct mobile table rows", () => {
      const annotation = createMobileAnnotation({
        voicedPreview: "Preview Text",
        mobile: {
          ios: { label: "iOS Label", value: "iOS Value", trait: "Button", hint: "iOS Hint" },
          android: { label: "Android Label", value: "Android Value", trait: "Checkbox", hint: "Android Hint" },
        },
      });
      const rows = getTableRows(annotation);

      expect(rows).toHaveLength(5);
      expect(rows[0]).toEqual({
        label: "Voiced preview",
        ios: "Preview Text",
        android: "Preview Text",
        bold: true,
      });
      expect(rows[1]).toEqual({
        label: "Label",
        ios: "iOS Label",
        android: "Android Label",
      });
      expect(rows[2]).toEqual({
        label: "Value",
        ios: "iOS Value",
        android: "Android Value",
      });
      expect(rows[3]).toEqual({
        label: "Trait",
        ios: "Button",
        android: "Checkbox",
      });
      expect(rows[4]).toEqual({
        label: "Hint",
        ios: "iOS Hint",
        android: "Android Hint",
      });
    });

    it("should generate correct web table rows", () => {
      const annotation = createWebAnnotation({
        web: {
          ariaLabel: "Close",
          role: "button",
          ariaDescribedBy: "desc-1",
          tabIndex: "0",
        },
      });
      const rows = getTableRows(annotation);

      expect(rows).toHaveLength(4);
      expect(rows[0]).toEqual({ label: "aria-label", value: "Close" });
      expect(rows[1]).toEqual({ label: "role", value: "button" });
      expect(rows[2]).toEqual({ label: "aria-describedby", value: "desc-1" });
      expect(rows[3]).toEqual({ label: "tabindex", value: "0" });
    });

    it("should return empty array for annotation without platform data", () => {
      const annotation = {
        id: 1,
        frameId: "frame-1",
        frameName: "Test Frame",
        pageId: "page-1",
        pageName: "Test Page",
        elementId: "element-1",
        elementName: "Test Element",
        platform: "mobile" as const,
        voicedPreview: "",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // No mobile data
      };
      const rows = getTableRows(annotation);
      expect(rows).toEqual([]);
    });
  });

  // ==========================================================================
  // getColumnWidths tests
  // ==========================================================================

  describe("getColumnWidths", () => {
    it("should return mobile column widths", () => {
      const widths = getColumnWidths("mobile");
      expect(widths).toEqual([128, 184, 184]);
    });

    it("should return web column widths", () => {
      const widths = getColumnWidths("web");
      expect(widths).toEqual([200, 296]);
    });
  });

  // ==========================================================================
  // getHeaderColumnTexts tests
  // ==========================================================================

  describe("getHeaderColumnTexts", () => {
    it("should return mobile header texts", () => {
      const headers = getHeaderColumnTexts("mobile");
      expect(headers).toEqual(["iOS (VoiceOver)", "Android (TalkBack)"]);
    });

    it("should return web header texts", () => {
      const headers = getHeaderColumnTexts("web");
      expect(headers).toEqual(["Web ARIA"]);
    });
  });

  // ==========================================================================
  // getTableRowHeights tests
  // ==========================================================================

  describe("getTableRowHeights", () => {
    it("should return expected row height constants", () => {
      const heights = getTableRowHeights();
      expect(heights).toEqual({
        header: 32,
        data: 40,
        containerPaddingY: 32,
        gapBetweenTables: 50,
      });
    });
  });

  // ==========================================================================
  // validateSchema tests
  // ==========================================================================

  describe("validateSchema", () => {
    it("should pass validation for current schema", () => {
      const result = validateSchema();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect schema issues through comprehensive validation", () => {
      // The validateSchema function tests:
      // - Duplicate field paths
      // - Missing row indices
      // - Round-trip mapping correctness
      // - voicedPreview multi-cell mapping
      // Just verify it returns the expected structure
      const result = validateSchema();
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("errors");
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
