import { loadFontsAsync } from "@create-figma-plugin/utilities";
import { Logger } from "../utils/logger";
import type { Annotation } from "../types";
import {
  getTableRows,
  getColumnWidths,
  getHeaderColumnTexts,
} from "../schema/annotation-fields";
import {
  createRowWithLockedBackground,
  createCellText,
} from "../utils/node-factory";

// ============================================================================
// WEB TABLE RENDERER - Web platform-specific table rendering
// ============================================================================

export class WebTableRenderer {
  /**
   * Create a web table row with label and value columns
   */
  async createWebTableRow(label: string, value: string): Promise<FrameNode> {
    // Use schema-driven column widths
    const columnWidths = getColumnWidths("web");
    const [labelWidth, valueWidth] = columnWidths;
    if (labelWidth === undefined || valueWidth === undefined) {
      throw new Error("Missing labelWidth or valueWidth from columnWidths");
    }

    // Calculate row width dynamically from schema
    const totalColumnWidth = columnWidths.reduce(
      (sum, width) => sum + width,
      0
    );
    const paddingLeft = 12;
    const paddingRight = 12;
    const itemSpacing = 8;
    const totalItemSpacing = (columnWidths.length - 1) * itemSpacing;
    const rowWidth =
      totalColumnWidth + paddingLeft + paddingRight + totalItemSpacing;

    // Create row with locked background using helper
    const row = createRowWithLockedBackground(
      rowWidth,
      40,
      { r: 1, g: 1, b: 1 }, // White background for data rows
      { r: 0.9, g: 0.91, b: 0.93 } // Gray border
    );

    row.appendChild(await createCellText(label, labelWidth, false));
    row.appendChild(await createCellText(value, valueWidth, false));

    return row;
  }

  /**
   * Create web table header column
   */
  async createWebTableHeaderColumn(
    createHeaderText: (text: string, width: number) => Promise<FrameNode>
  ): Promise<FrameNode> {
    // Use schema-driven header text and column width
    const headerTexts = getHeaderColumnTexts("web");
    const columnWidths = getColumnWidths("web");
    const [, valueWidth] = columnWidths; // Skip label column
    if (valueWidth === undefined) {
      throw new Error("Invalid column widths for web platform");
    }
    const headerText = headerTexts[0];
    if (!headerText) {
      throw new Error("Invalid header texts for web platform");
    }
    return await createHeaderText(headerText, valueWidth);
  }

  /**
   * Create all web table rows for an annotation
   * Uses schema-driven approach - automatically handles all fields defined in schema
   */
  async createWebTableRows(ann: Annotation): Promise<FrameNode[]> {
    if (!ann.web) {
      return [];
    }

    // Use schema-driven approach - automatically handles all web fields
    const schemaRows = getTableRows(ann);
    const rows: FrameNode[] = [];

    for (const row of schemaRows) {
      if (row.value !== undefined) {
        rows.push(await this.createWebTableRow(row.label, row.value));
      }
    }

    return rows;
  }

  /**
   * Update web table rows in place
   */
  async updateWebTableRows(
    table: FrameNode,
    ann: Annotation,
    expectedRows: Array<{
      label: string;
      value: string;
    }>
  ): Promise<boolean> {
    if (!ann.web) {
      return false;
    }

    try {
      // Batch load fonts for all text nodes
      const allTextNodes = table.findAll(
        (n) => n.type === "TEXT"
      ) as TextNode[];
      await loadFontsAsync(allTextNodes);

      const existingRows = table.children.slice(1); // Skip header

      for (let i = 0; i < expectedRows.length; i++) {
        const expectedRow = expectedRows[i];
        const existingRow = existingRows[i] as FrameNode;

        if (!existingRow || existingRow.type !== "FRAME") {
          return false;
        }

        // Find text nodes in the row
        // Schema cellIndex mapping: 0=label, 1=value
        // Text nodes are found in order: [labelText, valueText]
        const textNodes = existingRow.findAll(
          (n) => n.type === "TEXT"
        ) as TextNode[];

        // Web rows have: label, value (2 text nodes)
        // Text node indices match schema cellIndex values:
        // - textNodes[0] = label (schema cellIndex 0)
        // - textNodes[1] = value (schema cellIndex 1)
        if (textNodes.length >= 2) {
          const labelNode = textNodes[0];
          const valueNode = textNodes[1];
          const expectedRowValue = expectedRow;
          if (!labelNode || !valueNode || !expectedRowValue) {
            return false;
          }
          // Update label (index 0, schema cellIndex 0)
          if (labelNode.characters !== expectedRowValue.label) {
            labelNode.characters = expectedRowValue.label;
          }
          // Update value (index 1, schema cellIndex 1)
          if (valueNode.characters !== expectedRowValue.value) {
            valueNode.characters = expectedRowValue.value;
          }
        } else {
          return false;
        }
      }

      return true;
    } catch (error) {
      Logger.error("Update web table rows", error);
      return false;
    }
  }
}

