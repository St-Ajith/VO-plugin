// ============================================================================
// ANNOTATION FIELD SCHEMA - Single source of truth for field definitions
// ============================================================================
// This module defines the structure of annotation fields, their table row
// positions, and provides helpers for mapping between field paths and cell
// locations. This ensures consistency across UI, canvas rendering, and parsing.
// ============================================================================

import type { Annotation } from "../types";

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

export type Platform = "mobile" | "web";
export type MobileSubPlatform = "ios" | "android";

export interface FieldDefinition {
  /** Field path used in updates (e.g., "mobile.ios.label", "voicedPreview") */
  path: string;
  /** Display label for the field */
  label: string;
  /** Platform this field belongs to */
  platform: Platform;
  /** For mobile fields, which sub-platform (null for voicedPreview which applies to both) */
  subPlatform: MobileSubPlatform | null;
  /** Row index in the table (0-based, excluding header) */
  rowIndex: number;
  /** Cell index in the row (0=label, 1=ios/value, 2=android) */
  cellIndex: number;
  /** Whether this field maps to multiple cells (like voicedPreview) */
  multiCell: boolean;
}

// ============================================================================
// MOBILE FIELD DEFINITIONS
// ============================================================================

export const MOBILE_FIELDS: FieldDefinition[] = [
  // Special case: voicedPreview maps to both iOS and Android columns
  {
    path: "voicedPreview",
    label: "Voiced preview",
    platform: "mobile",
    subPlatform: null,
    rowIndex: 0,
    cellIndex: 1, // iOS column (will also map to Android)
    multiCell: true,
  },
  {
    path: "mobile.ios.label",
    label: "Label",
    platform: "mobile",
    subPlatform: "ios",
    rowIndex: 1,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "mobile.android.label",
    label: "Label",
    platform: "mobile",
    subPlatform: "android",
    rowIndex: 1,
    cellIndex: 2,
    multiCell: false,
  },
  {
    path: "mobile.ios.value",
    label: "Value",
    platform: "mobile",
    subPlatform: "ios",
    rowIndex: 2,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "mobile.android.value",
    label: "Value",
    platform: "mobile",
    subPlatform: "android",
    rowIndex: 2,
    cellIndex: 2,
    multiCell: false,
  },
  {
    path: "mobile.ios.trait",
    label: "Trait",
    platform: "mobile",
    subPlatform: "ios",
    rowIndex: 3,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "mobile.android.trait",
    label: "Trait",
    platform: "mobile",
    subPlatform: "android",
    rowIndex: 3,
    cellIndex: 2,
    multiCell: false,
  },
  {
    path: "mobile.ios.hint",
    label: "Hint",
    platform: "mobile",
    subPlatform: "ios",
    rowIndex: 4,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "mobile.android.hint",
    label: "Hint",
    platform: "mobile",
    subPlatform: "android",
    rowIndex: 4,
    cellIndex: 2,
    multiCell: false,
  },
];

// ============================================================================
// WEB FIELD DEFINITIONS
// ============================================================================

export const WEB_FIELDS: FieldDefinition[] = [
  {
    path: "web.ariaLabel",
    label: "aria-label",
    platform: "web",
    subPlatform: null,
    rowIndex: 0,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "web.role",
    label: "role",
    platform: "web",
    subPlatform: null,
    rowIndex: 1,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "web.ariaDescribedBy",
    label: "aria-describedby",
    platform: "web",
    subPlatform: null,
    rowIndex: 2,
    cellIndex: 1,
    multiCell: false,
  },
  {
    path: "web.tabIndex",
    label: "tabindex",
    platform: "web",
    subPlatform: null,
    rowIndex: 3,
    cellIndex: 1,
    multiCell: false,
  },
];

// ============================================================================
// ALL FIELDS LOOKUP
// ============================================================================

export const ALL_FIELDS: FieldDefinition[] = [...MOBILE_FIELDS, ...WEB_FIELDS];

// ============================================================================
// FIELD LOOKUP HELPERS
// ============================================================================

/**
 * Find field definition by path
 */
export function getFieldDefinition(fieldPath: string): FieldDefinition | null {
  return ALL_FIELDS.find((f) => f.path === fieldPath) || null;
}

/**
 * Get all cell locations for a field path
 * Returns multiple locations for multi-cell fields like voicedPreview
 */
export function getFieldCellLocations(
  fieldPath: string,
  platform: Platform
): Array<{ rowIndex: number; cellIndex: number }> | null {
  const field = getFieldDefinition(fieldPath);
  if (!field || field.platform !== platform) {
    return null;
  }

  // Special handling for voicedPreview - maps to both iOS and Android columns
  if (fieldPath === "voicedPreview" && platform === "mobile") {
    return [
      { rowIndex: 0, cellIndex: 1 }, // iOS column
      { rowIndex: 0, cellIndex: 2 }, // Android column
    ];
  }

  return [{ rowIndex: field.rowIndex, cellIndex: field.cellIndex }];
}

/**
 * Map field path to table cell location(s)
 * Returns null if field path is unknown
 */
export function mapFieldPathToCellLocation(
  fieldPath: string,
  platform: Platform
): Array<{ rowIndex: number; cellIndex: number }> | null {
  return getFieldCellLocations(fieldPath, platform);
}

/**
 * Map table cell location to field path
 * Inverse of mapFieldPathToCellLocation
 * Fully dynamic - derives logic from ALL_FIELDS array
 */
export function mapCellLocationToFieldPath(
  rowIndex: number,
  cellIndex: number,
  platform: Platform
): string | null {
  // Label column (cellIndex 0) is not editable
  if (cellIndex === 0) {
    return null;
  }

  // Find fields matching this platform and row
  const platformFields = ALL_FIELDS.filter((f) => f.platform === platform);
  const rowFields = platformFields.filter((f) => f.rowIndex === rowIndex);

  if (rowFields.length === 0) {
    return null;
  }

  if (platform === "mobile") {
    // Cell index: 1=ios, 2=android
    const isIosColumn = cellIndex === 1;
    const isAndroidColumn = cellIndex === 2;

    // Special case: voicedPreview maps to both iOS and Android columns
    const voicedPreviewField = rowFields.find(
      (f) => f.path === "voicedPreview" && f.multiCell
    );
    if (voicedPreviewField && (isIosColumn || isAndroidColumn)) {
      return "voicedPreview";
    }

    // For other fields, match by subPlatform and cellIndex
    const matchingField = rowFields.find((f) => {
      if (f.subPlatform === "ios" && isIosColumn) return true;
      if (f.subPlatform === "android" && isAndroidColumn) return true;
      return false;
    });

    return matchingField ? matchingField.path : null;
  } else if (platform === "web") {
    // Cell index: 1=value (only editable column)
    if (cellIndex !== 1) {
      return null;
    }

    // Web fields don't have subPlatform, so just find the field for this row
    const matchingField = rowFields.find((f) => f.cellIndex === cellIndex);
    return matchingField ? matchingField.path : null;
  }

  return null;
}

/**
 * Get table row structure for an annotation
 * Returns rows in the order they should appear in the table
 * Fully dynamic - generates rows from schema definitions
 */
export function getTableRows(annotation: Annotation): Array<{
  label: string;
  ios?: string;
  android?: string;
  value?: string;
  bold?: boolean;
}> {
  if (annotation.platform === "mobile" && annotation.mobile) {
    // Get all mobile fields, grouped by row index
    const mobileFields = ALL_FIELDS.filter((f) => f.platform === "mobile");
    const maxRow = Math.max(...mobileFields.map((f) => f.rowIndex), -1);

    const rows: Array<{
      label: string;
      ios?: string;
      android?: string;
      bold?: boolean;
    }> = [];

    // Generate rows in order (0 to maxRow)
    for (let i = 0; i <= maxRow; i++) {
      const rowFields = mobileFields.filter((f) => f.rowIndex === i);
      if (rowFields.length === 0) continue;

      // Use the first field's label as the row label
      const firstField = rowFields[0];
      if (!firstField) continue;
      const rowLabel = firstField.label;

      // Special case: voicedPreview (multi-cell field)
      const voicedPreviewField = rowFields.find(
        (f) => f.path === "voicedPreview" && f.multiCell
      );
      if (voicedPreviewField) {
        rows.push({
          label: rowLabel,
          ios: annotation.voicedPreview,
          android: annotation.voicedPreview,
          bold: true,
        });
        continue;
      }

      // Standard fields: find iOS and Android fields for this row
      const iosField = rowFields.find((f) => f.subPlatform === "ios");
      const androidField = rowFields.find((f) => f.subPlatform === "android");

      const row: {
        label: string;
        ios?: string;
        android?: string;
      } = { label: rowLabel };

      if (iosField) {
        row.ios = getFieldValue(annotation, iosField.path) || "";
      }
      if (androidField) {
        row.android = getFieldValue(annotation, androidField.path) || "";
      }

      rows.push(row);
    }

    return rows;
  } else if (annotation.platform === "web" && annotation.web) {
    // Get all web fields, grouped by row index
    const webFields = ALL_FIELDS.filter((f) => f.platform === "web");
    const maxRow = Math.max(...webFields.map((f) => f.rowIndex), -1);

    const rows: Array<{
      label: string;
      value?: string;
    }> = [];

    // Generate rows in order (0 to maxRow)
    for (let i = 0; i <= maxRow; i++) {
      const rowFields = webFields.filter((f) => f.rowIndex === i);
      if (rowFields.length === 0) continue;

      // Use the first field's label as the row label
      const firstField = rowFields[0];
      if (!firstField) continue;
      const rowLabel = firstField.label;
      const field = firstField; // Web fields have one field per row

      rows.push({
        label: rowLabel,
        value: getFieldValue(annotation, field.path) || "",
      });
    }

    return rows;
  }

  return [];
}

/**
 * Get field value from annotation by field path
 */
export function getFieldValue(
  annotation: Annotation,
  fieldPath: string
): string | null {
  if (fieldPath === "voicedPreview") {
    return annotation.voicedPreview;
  }

  const parts = fieldPath.split(".");
  if (parts.length === 3 && parts[0] === "mobile") {
    const subPlatform = parts[1] as MobileSubPlatform;
    const fieldName = parts[2] as "label" | "value" | "trait" | "hint";
    if (annotation.mobile && annotation.mobile[subPlatform]) {
      const subPlatformData = annotation.mobile[subPlatform];
      if (subPlatformData) {
        return subPlatformData[fieldName] || null;
      }
    }
  } else if (parts.length === 2 && parts[0] === "web") {
    const fieldName = parts[1] as keyof typeof annotation.web;
    if (annotation.web) {
      return annotation.web[fieldName] || null;
    }
  }

  return null;
}

// ============================================================================
// COLUMN WIDTH AND HEADER TEXT FUNCTIONS
// ============================================================================

/**
 * Get column widths for a platform
 * Returns array of column widths including label column
 * Mobile: [128, 184, 184] (label, iOS, Android)
 * Web: [200, 296] (label, value)
 */
export function getColumnWidths(platform: Platform): number[] {
  if (platform === "mobile") {
    return [128, 184, 184]; // label, iOS, Android
  } else {
    return [200, 296]; // label, value
  }
}

/**
 * Get header column texts for a platform
 * Returns array of header texts (excluding label column which is always first)
 * Mobile: ["iOS (VoiceOver)", "Android (TalkBack)"]
 * Web: ["Web ARIA"]
 */
export function getHeaderColumnTexts(platform: Platform): string[] {
  if (platform === "mobile") {
    return ["iOS (VoiceOver)", "Android (TalkBack)"];
  } else {
    return ["Web ARIA"];
  }
}

/**
 * Get table row height constants
 * Returns row heights in pixels for consistent table rendering
 */
export function getTableRowHeights(): {
  header: number;
  data: number;
  containerPaddingY: number;
  gapBetweenTables: number;
} {
  return {
    header: 32, // Header row height (fixed)
    data: 40, // Data row height (fixed)
    containerPaddingY: 32, // Container padding top + bottom (16 + 16)
    gapBetweenTables: 50, // Spacing between stacked tables
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate that all field mappings are correct and complete
 * Checks:
 * - All fields can be mapped to cell locations
 * - All cell locations can be mapped back to fields (round-trip)
 * - No duplicate field paths
 * - Row indices are sequential
 */
export function validateSchema(): ValidationResult {
  const errors: string[] = [];

  // Check for duplicate field paths
  const paths = new Set<string>();
  for (const field of ALL_FIELDS) {
    if (paths.has(field.path)) {
      errors.push(`Duplicate field path: ${field.path}`);
    }
    paths.add(field.path);
  }

  // Validate mobile fields
  const mobileFields = ALL_FIELDS.filter((f) => f.platform === "mobile");
  const mobileRowIndices = mobileFields
    .map((f) => f.rowIndex)
    .sort((a, b) => a - b);
  const expectedMobileRows = [0, 1, 2, 3, 4];
  for (let i = 0; i < expectedMobileRows.length; i++) {
    const expectedRow = expectedMobileRows[i];
    if (expectedRow !== undefined && !mobileRowIndices.includes(expectedRow)) {
      errors.push(`Missing mobile row index: ${expectedRow}`);
    }
  }

  // Validate web fields
  const webFields = ALL_FIELDS.filter((f) => f.platform === "web");
  const webRowIndices = webFields.map((f) => f.rowIndex).sort((a, b) => a - b);
  const expectedWebRows = [0, 1, 2, 3];
  for (let i = 0; i < expectedWebRows.length; i++) {
    const expectedRow = expectedWebRows[i];
    if (expectedRow !== undefined && !webRowIndices.includes(expectedRow)) {
      errors.push(`Missing web row index: ${expectedRow}`);
    }
  }

  // Test round-trip mapping for all fields
  for (const field of ALL_FIELDS) {
    const cellLocations = mapFieldPathToCellLocation(
      field.path,
      field.platform
    );
    if (!cellLocations || cellLocations.length === 0) {
      errors.push(`Field ${field.path} cannot be mapped to cell locations`);
      continue;
    }

    // For multi-cell fields, test all cells
    for (const cellLocation of cellLocations) {
      const mappedBack = mapCellLocationToFieldPath(
        cellLocation.rowIndex,
        cellLocation.cellIndex,
        field.platform
      );
      // Special case: voicedPreview maps to both iOS and Android, but maps back to same field
      if (field.path === "voicedPreview") {
        if (mappedBack !== "voicedPreview") {
          errors.push(
            `Round-trip failed for ${field.path} at row ${cellLocation.rowIndex}, cell ${cellLocation.cellIndex}: got ${mappedBack}`
          );
        }
      } else if (mappedBack !== field.path) {
        errors.push(
          `Round-trip failed for ${field.path} at row ${cellLocation.rowIndex}, cell ${cellLocation.cellIndex}: got ${mappedBack}`
        );
      }
    }
  }

  // Test special case: voicedPreview should map to both iOS and Android columns
  const voicedPreviewLocations = mapFieldPathToCellLocation(
    "voicedPreview",
    "mobile"
  );
  if (!voicedPreviewLocations || voicedPreviewLocations.length !== 2) {
    errors.push(
      `voicedPreview should map to 2 cells (iOS + Android), got ${
        voicedPreviewLocations?.length || 0
      }`
    );
  } else {
    const iosCell = voicedPreviewLocations.find((c) => c.cellIndex === 1);
    const androidCell = voicedPreviewLocations.find((c) => c.cellIndex === 2);
    if (!iosCell || !androidCell) {
      errors.push(
        "voicedPreview should map to both iOS (cell 1) and Android (cell 2) columns"
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate schema on module load (development only)
 * This helps catch schema issues early
 * Note: Call this manually in development/testing environments
 */
export function validateSchemaOnLoad(): void {
  const validation = validateSchema();
  if (!validation.isValid) {
    console.warn(
      "Annotation field schema validation failed:",
      validation.errors
    );
  }
}
