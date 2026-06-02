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
// MOBILE TABLE RENDERER - Mobile platform-specific table rendering
// ============================================================================

export class MobileTableRenderer {
  /**
   * Create a mobile table row with label, iOS, and Android columns
   */
  async createTableRow(
    label: string,
    ios: string | undefined,
    android: string | undefined,
    bold: boolean = false
  ): Promise<FrameNode> {
    // Use schema-driven column widths
    const columnWidths = getColumnWidths("mobile");
    const [labelWidth, iosWidth, androidWidth] = columnWidths;
    if (labelWidth === undefined || iosWidth === undefined || androidWidth === undefined) {
      throw new Error("Invalid column widths for mobile platform");
    }

    // Create row with locked background using helper
    const row = createRowWithLockedBackground(
      528,
      40,
      { r: 1, g: 1, b: 1 }, // White background for data rows
      { r: 0.9, g: 0.91, b: 0.93 } // Gray border
    );

    // Use empty string for missing platform values (handles asymmetric rows)
    const iosText = ios ?? "";
    const androidText = android ?? "";

    row.appendChild(await createCellText(label, labelWidth, false));
    row.appendChild(await createCellText(iosText, iosWidth, bold));
    row.appendChild(await createCellText(androidText, androidWidth, bold));

    return row;
  }

  /**
   * Create mobile table header columns (iOS and Android) - badge is handled by caller
   */
  async createMobileTableHeaderColumns(
    createHeaderText: (text: string, width: number) => Promise<FrameNode>
  ): Promise<FrameNode[]> {
    // Use schema-driven header texts and column widths
    const headerTexts = getHeaderColumnTexts("mobile");
    const columnWidths = getColumnWidths("mobile");
    const [, iosWidth, androidWidth] = columnWidths; // Skip label column
    if (iosWidth === undefined || androidWidth === undefined) {
      throw new Error("Invalid column widths for mobile platform");
    }

    const columns: FrameNode[] = [];
    const iosHeaderText = headerTexts[0];
    const androidHeaderText = headerTexts[1];
    if (iosHeaderText && androidHeaderText) {
      columns.push(await createHeaderText(iosHeaderText, iosWidth));
      columns.push(await createHeaderText(androidHeaderText, androidWidth));
    }
    return columns;
  }

  /**
   * Create mobile table header row with iOS and Android columns (legacy - kept for compatibility)
   */
  async createMobileTableHeader(
    id: number,
    createHeaderText: (text: string, width: number) => Promise<FrameNode>,
    _createCellText: (
      text: string,
      width: number,
      bold?: boolean
    ) => Promise<FrameNode>
  ): Promise<FrameNode> {
    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "FIXED";
    row.counterAxisSizingMode = "FIXED"; // Fixed height for consistent row spacing
    row.primaryAxisAlignItems = "MIN"; // Left align horizontally
    row.counterAxisAlignItems = "CENTER"; // Center align vertically
    row.resize(528, 32); // Header row height (smaller than data rows)
    row.paddingTop = 8;
    row.paddingBottom = 8;
    row.paddingLeft = 12;
    row.paddingRight = 12;
    row.itemSpacing = 8;
    row.fills = [{ type: "SOLID", color: { r: 0.82, g: 0.84, b: 0.86 } }];

    // Use schema-driven column widths
    const columnWidths = getColumnWidths("mobile");
    const labelColumnWidth = columnWidths[0];
    if (labelColumnWidth === undefined) {
      throw new Error("Invalid column widths for mobile platform");
    }

    // Create badge cell container that matches label column width
    const badgeCell = figma.createFrame();
    badgeCell.layoutMode = "HORIZONTAL";
    badgeCell.primaryAxisSizingMode = "FIXED";
    badgeCell.counterAxisSizingMode = "FIXED";
    badgeCell.primaryAxisAlignItems = "MIN"; // Left align
    badgeCell.counterAxisAlignItems = "CENTER"; // Center align vertically
    badgeCell.resize(labelColumnWidth, 24);
    badgeCell.fills = [];
    badgeCell.paddingLeft = 8;
    badgeCell.paddingRight = 8;
    badgeCell.paddingTop = 0;
    badgeCell.paddingBottom = 0;

    // Create badge container frame for proper layering
    const badgeContainer = figma.createFrame();
    badgeContainer.resize(24, 24);
    badgeContainer.fills = [];
    badgeContainer.layoutMode = "NONE"; // Use absolute positioning

    // Create rectangle first (bottom layer)
    const badgeRect = figma.createRectangle();
    badgeRect.resize(24, 24);
    badgeRect.x = 0;
    badgeRect.y = 0;
    badgeRect.fills = [{ type: "SOLID", color: { r: 0.42, g: 0.45, b: 0.49 } }];
    badgeRect.cornerRadius = 4;
    badgeContainer.appendChild(badgeRect);

    // Create text second (top layer) - positioned on top of rectangle
    const badgeNum = figma.createText();
    await loadFontsAsync([badgeNum]);
    badgeNum.characters = id.toString();
    badgeNum.fontSize = 14;
    badgeNum.fontName = { family: "Inter", style: "Bold" };
    badgeNum.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    badgeNum.resize(24, 24);
    badgeNum.x = 0;
    badgeNum.y = 0;
    badgeNum.textAlignHorizontal = "CENTER";
    badgeNum.textAlignVertical = "CENTER";
    badgeContainer.appendChild(badgeNum);

    badgeCell.appendChild(badgeContainer);
    row.appendChild(badgeCell);

    // Add iOS and Android header columns using schema-driven values
    const headerTexts = getHeaderColumnTexts("mobile");
    const [, iosWidth, androidWidth] = columnWidths; // Skip label column
    if (iosWidth === undefined || androidWidth === undefined) {
      throw new Error("Invalid column widths for mobile platform");
    }
    const iosHeaderText = headerTexts[0];
    const androidHeaderText = headerTexts[1];
    if (iosHeaderText && androidHeaderText) {
      row.appendChild(await createHeaderText(iosHeaderText, iosWidth));
      row.appendChild(await createHeaderText(androidHeaderText, androidWidth));
    }

    return row;
  }

  /**
   * Create all mobile table rows for an annotation
   */
  async createMobileTableRows(ann: Annotation): Promise<FrameNode[]> {
    if (!ann.mobile) {
      return [];
    }

    // Use schema-driven approach - automatically handles asymmetric rows
    const schemaRows = getTableRows(ann);
    const rows: FrameNode[] = [];

    for (const row of schemaRows) {
      rows.push(
        await this.createTableRow(row.label, row.ios, row.android, row.bold)
      );
    }

    return rows;
  }

  /**
   * Update mobile table rows in place
   */
  async updateMobileTableRows(
    table: FrameNode,
    ann: Annotation,
    expectedRows: Array<{
      label: string;
      ios?: string;
      android?: string;
      bold?: boolean;
    }>
  ): Promise<boolean> {
    if (!ann.mobile) {
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
        // Schema cellIndex mapping: 0=label, 1=iOS, 2=Android
        // Text nodes are found in order: [labelText, iosText, androidText]
        const textNodes = existingRow.findAll(
          (n) => n.type === "TEXT"
        ) as TextNode[];

        // Mobile rows have: label, ios, android (3 text nodes)
        // Text node indices match schema cellIndex values:
        // - textNodes[0] = label (schema cellIndex 0)
        // - textNodes[1] = iOS value (schema cellIndex 1)
        // - textNodes[2] = Android value (schema cellIndex 2)
        if (textNodes.length >= 3) {
          const labelNode = textNodes[0];
          const iosNode = textNodes[1];
          const androidNode = textNodes[2];
          const expectedRowValue = expectedRow;
          if (!labelNode || !iosNode || !androidNode || !expectedRowValue) {
            return false;
          }
          // Update label (index 0, schema cellIndex 0)
          if (labelNode.characters !== expectedRowValue.label) {
            labelNode.characters = expectedRowValue.label;
          }
          // Update iOS value (index 1, schema cellIndex 1) - handle undefined with empty string
          const iosValue = expectedRowValue.ios ?? "";
          if (iosNode.characters !== iosValue) {
            iosNode.characters = iosValue;
          }
          // Update Android value (index 2, schema cellIndex 2) - handle undefined with empty string
          const androidValue = expectedRowValue.android ?? "";
          if (androidNode.characters !== androidValue) {
            androidNode.characters = androidValue;
          }
        } else {
          return false;
        }
      }

      return true;
    } catch (error) {
      Logger.error("Update mobile table rows", error);
      return false;
    }
  }
}

