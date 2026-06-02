// ============================================================================
// CANVAS SERVICE - Canvas rendering and annotation table operations
// ============================================================================

import { Annotation, ContainerMetadata } from "../types";
import { Logger } from "../utils/logger";
import {
  loadFontsAsync,
  computeBoundingBox,
} from "@create-figma-plugin/utilities";
import { MobileTableRenderer } from "./canvas-platform-mobile";
import { WebTableRenderer } from "./canvas-platform-web";
import { BadgeRenderer } from "./canvas-badge";
import { CanvasParser, type CanvasParserDependencies } from "./canvas-parser";
import {
  mapFieldPathToCellLocation as schemaMapFieldToCell,
  mapCellLocationToFieldPath as schemaMapCellToField,
  getTableRows,
  getColumnWidths,
  getTableRowHeights,
  type Platform,
} from "../schema/annotation-fields";
import {
  findNonOverlappingPosition,
  type Rectangle,
} from "../utils/bounds-helpers";
import { benchmark, PERFORMANCE_THRESHOLDS } from "../utils/benchmark";
import { withTransaction } from "../utils/transaction-wrapper";

// ============================================================================
// CONTAINER ARCHITECTURE DOCUMENTATION
// ============================================================================
// Each annotated frame has one auto-layout container holding all artifacts:
// - Container: Horizontal auto-layout, positioned at frame's right edge + 60px
//   - Badge Column (left): Vertical auto-layout, stacks badges with 8px gap
//   - Table Column (right): Vertical auto-layout, stacks tables with 50px gap
// - Badges and tables are inserted in annotation ID order (sorted)
// - Auto-layout handles all positioning and collision avoidance automatically
// - Legacy mode: Falls back to manual positioning when containers are not available
// ============================================================================

// Table metadata key for plugin data
const TABLE_METADATA_KEY = "voice_over_annotations_tableMetadata";

// Container metadata key for plugin data
const CONTAINER_METADATA_KEY = "voice_over_annotations_containerMetadata";

// Container naming constant
const CONTAINER_NAME_PREFIX = "Annotation Container";

// Cache for annotation table ID to source frameId mapping (O(1) lookups)
const annotationTableToFrameCache = new Map<string, string>();

// Table dimension constants for deterministic height calculation
// These are derived from schema to maintain single source of truth
const ROW_HEIGHTS = getTableRowHeights();
const TABLE_PADDING_Y = ROW_HEIGHTS.containerPaddingY;
const HEADER_HEIGHT = ROW_HEIGHTS.header;
const DATA_ROW_HEIGHT = ROW_HEIGHTS.data;
const GAP_HEIGHT = ROW_HEIGHTS.gapBetweenTables;

// Table positioning constants
const FRAME_TO_TABLE_GAP = 60; // Gap between frame's right edge and table column

/**
 * Table metadata structure stored in plugin data
 */
interface TableMetadata {
  sourceFrameId: string;
  annotationId: number;
  version: number;
  timestamp: number;
  position?: {
    x: number;
    y: number;
    elementId: string | null;
    locked: boolean;
  };
}

export class CanvasService {
  // Platform-specific table renderers
  private readonly mobileRenderer = new MobileTableRenderer();
  private readonly webRenderer = new WebTableRenderer();
  // Badge renderer for annotation badges
  private readonly badgeRenderer = new BadgeRenderer();
  // Canvas parser for parsing annotation data from tables
  private readonly parser: CanvasParser;
  // Annotation store for lookup fallback during parsing
  private readonly annotationStore?: {
    getAll: () => Annotation[];
  };

  constructor(annotationStore?: { getAll: () => Annotation[] }) {
    if (annotationStore !== undefined) {
      this.annotationStore = annotationStore;
    }
    // Initialize parser with dependencies
    const dependencies: CanvasParserDependencies = {
      readTableMetadata: (table: FrameNode) => this.readTableMetadata(table),
      storeTableMetadata: (
        table: FrameNode,
        sourceFrameId: string,
        annotationId: number,
        version?: number,
        timestamp?: number,
        elementId?: string
      ) =>
        this.storeTableMetadata(
          table,
          sourceFrameId,
          annotationId,
          version,
          timestamp,
          elementId
        ),
    };
    if (annotationStore) {
      dependencies.getAnnotationById = (
        annotationId: number,
        frameId: string
      ) => {
        // Use composite key (annotationId + frameId) since IDs are frame-scoped
        return annotationStore
          .getAll()
          .find((a) => a.id === annotationId && a.frameId === frameId);
      };
    }
    this.parser = new CanvasParser(dependencies);
  }

  // ============================================================================
  // CONTAINER MANAGEMENT
  // ============================================================================

  /**
   * Create an annotation container for a frame
   * Container has horizontal auto-layout with badge column (left) and table column (right)
   */
  createAnnotationContainer(frameId: string): FrameNode {
    // Create main container with horizontal auto-layout
    const container = figma.createFrame();
    container.name = `${CONTAINER_NAME_PREFIX} - ${frameId}`;
    container.layoutMode = "HORIZONTAL";
    container.primaryAxisSizingMode = "AUTO";
    container.counterAxisSizingMode = "AUTO";
    container.itemSpacing = 8; // Gap between badge and table columns
    container.fills = [];
    container.paddingLeft = 0;
    container.paddingRight = 0;
    container.paddingTop = 0;
    container.paddingBottom = 0;

    // Create badge column (vertical auto-layout)
    const badgeColumn = figma.createFrame();
    badgeColumn.name = "Badge Column";
    badgeColumn.layoutMode = "VERTICAL";
    badgeColumn.primaryAxisSizingMode = "AUTO";
    badgeColumn.counterAxisSizingMode = "AUTO";
    badgeColumn.itemSpacing = 8; // Vertical gap between badges
    badgeColumn.fills = [];
    badgeColumn.paddingLeft = 0;
    badgeColumn.paddingRight = 0;
    badgeColumn.paddingTop = 0;
    badgeColumn.paddingBottom = 0;

    // Create table column (vertical auto-layout)
    const tableColumn = figma.createFrame();
    tableColumn.name = "Table Column";
    tableColumn.layoutMode = "VERTICAL";
    tableColumn.primaryAxisSizingMode = "AUTO";
    tableColumn.counterAxisSizingMode = "AUTO";
    tableColumn.itemSpacing = 50; // Vertical gap between tables (GAP_HEIGHT)
    tableColumn.fills = [];
    tableColumn.paddingLeft = 0;
    tableColumn.paddingRight = 0;
    tableColumn.paddingTop = 0;
    tableColumn.paddingBottom = 0;

    // Assemble container
    container.appendChild(badgeColumn);
    container.appendChild(tableColumn);

    // Store container metadata
    this.storeContainerMetadata(container, frameId);

    Logger.debug("Container creation", "Created annotation container", {
      frameId,
      containerId: container.id,
    });

    return container;
  }

  /**
   * Get existing container for a frame or create a new one
   */
  async getOrCreateContainer(frameId: string): Promise<FrameNode> {
    const containerName = `${CONTAINER_NAME_PREFIX} - ${frameId}`;

    // Try to find existing container on current page
    const existingContainer = figma.currentPage.findOne(
      (node) => node.name === containerName && node.type === "FRAME"
    ) as FrameNode | null;

    if (existingContainer && !existingContainer.removed) {
      Logger.debug("Container lookup", "Found existing container", {
        frameId,
        containerId: existingContainer.id,
      });
      return existingContainer;
    }

    // Create new container
    const container = this.createAnnotationContainer(frameId);

    // Position container relative to frame
    await this.positionContainerRelativeToFrame(container, frameId);

    // Add to current page
    figma.currentPage.appendChild(container);

    return container;
  }

  /**
   * Store container metadata in plugin data
   */
  storeContainerMetadata(
    container: FrameNode,
    sourceFrameId: string,
    version: number = 1,
    timestamp: number = Date.now()
  ): void {
    try {
      const metadata: ContainerMetadata = {
        sourceFrameId,
        version,
        timestamp,
      };
      container.setPluginData(CONTAINER_METADATA_KEY, JSON.stringify(metadata));

      Logger.debug("Container metadata", "Stored container metadata", {
        containerId: container.id,
        sourceFrameId,
        version,
        timestamp,
      });
    } catch (error) {
      Logger.error("Container metadata", "Failed to store container metadata", {
        containerId: container.id,
        sourceFrameId,
        error,
      });
      throw error;
    }
  }

  /**
   * Read container metadata from plugin data
   */
  readContainerMetadata(container: FrameNode): ContainerMetadata | null {
    try {
      const metadataStr = container.getPluginData(CONTAINER_METADATA_KEY);
      if (!metadataStr) {
        return null;
      }
      const metadata = JSON.parse(metadataStr) as ContainerMetadata;
      // Ensure version exists for legacy containers
      if (metadata.version === undefined) {
        metadata.version = 1;
      }
      return metadata;
    } catch (error) {
      Logger.error("Container metadata", "Failed to read container metadata", {
        containerId: container.id,
        error,
      });
      return null;
    }
  }

  /**
   * Position container relative to frame's right edge
   * Only repositions if frame moved significantly (>10px threshold)
   */
  async positionContainerRelativeToFrame(
    container: FrameNode,
    frameId: string
  ): Promise<void> {
    try {
      const frame = await figma.getNodeByIdAsync(frameId);
      if (
        !frame ||
        frame.removed ||
        (frame.type !== "FRAME" && frame.type !== "SECTION")
      ) {
        Logger.warn("Container positioning", "Frame not found or invalid", {
          frameId,
        });
        return;
      }

      const bounds = computeBoundingBox(frame as SceneNode);
      const targetX = bounds.x + bounds.width + FRAME_TO_TABLE_GAP;
      const targetY = bounds.y;

      // Only reposition if frame moved significantly (>10px threshold)
      const xDiff = Math.abs(container.x - targetX);
      const yDiff = Math.abs(container.y - targetY);

      if (xDiff > 10 || yDiff > 10) {
        container.x = targetX;
        container.y = targetY;

        Logger.debug("Container positioning", "Repositioned container", {
          frameId,
          containerX: container.x,
          containerY: container.y,
          xDiff,
          yDiff,
        });
      }
    } catch (error) {
      Logger.error("Container positioning", "Failed to position container", {
        frameId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get badge column from container
   */
  private getBadgeColumn(container: FrameNode): FrameNode | null {
    const badgeColumn = container.children.find(
      (child) => child.type === "FRAME" && child.name === "Badge Column"
    ) as FrameNode | undefined;
    return badgeColumn || null;
  }

  /**
   * Get table column from container
   */
  private getTableColumn(container: FrameNode): FrameNode | null {
    const tableColumn = container.children.find(
      (child) => child.type === "FRAME" && child.name === "Table Column"
    ) as FrameNode | undefined;
    return tableColumn || null;
  }

  /**
   * Insert badge into container at correct sorted position
   */
  insertBadgeIntoContainer(
    badge: FrameNode,
    container: FrameNode,
    annotationId: number
  ): void {
    const badgeColumn = this.getBadgeColumn(container);
    if (!badgeColumn) {
      Logger.error("Badge insertion", "Badge column not found in container", {
        containerId: container.id,
      });
      throw new Error("Badge column not found in container");
    }

    // Extract annotation IDs from existing badges
    const extractIdFromName = (name: string): number | null => {
      const match = name.match(/^Annotation Badge (\d+) -/);
      if (!match) return null;
      const [, idStr] = match;
      return idStr ? parseInt(idStr, 10) : null;
    };

    const sortedIds = badgeColumn.children
      .map((child) => extractIdFromName(child.name))
      .filter((id): id is number => id !== null)
      .sort((a, b) => a - b);

    // Find insertion index
    const insertIndex = sortedIds.findIndex((id) => id > annotationId);

    if (insertIndex === -1) {
      // Append to end
      badgeColumn.appendChild(badge);
    } else {
      // Insert at correct position
      badgeColumn.insertChild(insertIndex, badge);
    }

    Logger.debug("Badge insertion", "Inserted badge into container", {
      annotationId,
      insertIndex:
        insertIndex === -1 ? badgeColumn.children.length - 1 : insertIndex,
    });
  }

  /**
   * Insert table into container at correct sorted position
   */
  insertTableIntoContainer(
    table: FrameNode,
    container: FrameNode,
    annotationId: number
  ): void {
    const tableColumn = this.getTableColumn(container);
    if (!tableColumn) {
      Logger.error("Table insertion", "Table column not found in container", {
        containerId: container.id,
      });
      throw new Error("Table column not found in container");
    }

    // Extract annotation IDs from existing tables
    const extractIdFromName = (name: string): number | null => {
      const match = name.match(/^Annotation Table (\d+) -/);
      if (!match) return null;
      const [, idStr] = match;
      return idStr ? parseInt(idStr, 10) : null;
    };

    const sortedIds = tableColumn.children
      .map((child) => extractIdFromName(child.name))
      .filter((id): id is number => id !== null)
      .sort((a, b) => a - b);

    // Find insertion index
    const insertIndex = sortedIds.findIndex((id) => id > annotationId);

    if (insertIndex === -1) {
      // Append to end
      tableColumn.appendChild(table);
    } else {
      // Insert at correct position
      tableColumn.insertChild(insertIndex, table);
    }

    Logger.debug("Table insertion", "Inserted table into container", {
      annotationId,
      insertIndex:
        insertIndex === -1 ? tableColumn.children.length - 1 : insertIndex,
    });
  }

  /**
   * Store table metadata (source frameId, version, timestamp) in annotation table's plugin data
   */
  storeTableMetadata(
    table: FrameNode,
    sourceFrameId: string,
    annotationId: number,
    version?: number,
    timestamp?: number,
    elementId?: string
  ): Promise<void> {
    try {
      const metadata: TableMetadata = {
        sourceFrameId,
        annotationId,
        version: version ?? 1,
        timestamp: timestamp ?? Date.now(),
        position: {
          x: table.x,
          y: table.y,
          elementId: elementId ?? null,
          locked: false,
        },
      };
      table.setPluginData(TABLE_METADATA_KEY, JSON.stringify(metadata));

      // Update cache
      annotationTableToFrameCache.set(table.id, sourceFrameId);

      Logger.debug("Table metadata", "Stored table metadata", {
        tableId: table.id,
        sourceFrameId,
        annotationId,
        version: metadata.version,
        timestamp: metadata.timestamp,
      });
      return Promise.resolve();
    } catch (error) {
      Logger.error("Table metadata", "Failed to store table metadata", {
        tableId: table.id,
        sourceFrameId,
        annotationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Get source frameId for an annotation table (with caching)
   */
  getSourceFrameIdForTable(table: SceneNode): Promise<string | null> {
    if (table.type !== "FRAME") {
      return Promise.resolve(null);
    }

    const tableFrame = table;

    // Check cache first (fast path)
    const cachedFrameId = annotationTableToFrameCache.get(tableFrame.id);
    if (cachedFrameId) {
      return Promise.resolve(cachedFrameId);
    }

    // Try reading from plugin data
    const metadata = this.readTableMetadata(tableFrame);
    if (metadata) {
      annotationTableToFrameCache.set(tableFrame.id, metadata.sourceFrameId);
      return Promise.resolve(metadata.sourceFrameId);
    }

    // Fallback: parse from name (for legacy tables)
    const nameMatch = tableFrame.name.match(/^Annotation Table \d+ - (.+)$/);
    if (nameMatch) {
      const [, frameId] = nameMatch;
      if (frameId) {
        annotationTableToFrameCache.set(tableFrame.id, frameId);
        return Promise.resolve(frameId);
      }
    }

    return Promise.resolve(null);
  }

  /**
   * Read table metadata from annotation table's plugin data
   */
  readTableMetadata(table: FrameNode): TableMetadata | null {
    try {
      const metadataStr = table.getPluginData(TABLE_METADATA_KEY);
      if (!metadataStr) {
        return null;
      }
      const metadata = JSON.parse(metadataStr) as TableMetadata;
      // Ensure version exists for legacy tables
      if (metadata.version === undefined) {
        metadata.version = 1;
      }
      // Ensure position exists for legacy tables (backward compatible)
      if (metadata.position === undefined) {
        metadata.position = {
          x: table.x,
          y: table.y,
          elementId: null,
          locked: false,
        };
      }
      return metadata;
    } catch (error) {
      Logger.error("Table metadata", "Failed to read table metadata", {
        tableId: table.id,
        error,
      });
      return null;
    }
  }

  /**
   * Extract annotation data from table cells (delegates to CanvasParser)
   */
  async extractAnnotationDataFromTable(
    table: FrameNode,
    platform: "mobile" | "web"
  ): Promise<Partial<Annotation>> {
    return await this.parser.extractAnnotationDataFromTable(table, platform);
  }

  /**
   * Parse annotation data from a Figma table frame (delegates to CanvasParser)
   */
  async parseAnnotationFromTable(table: FrameNode): Promise<Annotation | null> {
    return await this.parser.parseAnnotationFromTable(table);
  }

  /**
   * Create header text component
   */
  private async createHeaderText(
    text: string,
    width: number
  ): Promise<FrameNode> {
    const container = figma.createFrame();
    container.layoutMode = "HORIZONTAL";
    container.primaryAxisSizingMode = "FIXED";
    container.counterAxisSizingMode = "FIXED"; // Fixed height for consistency
    container.primaryAxisAlignItems = "MIN"; // Left align horizontally
    container.counterAxisAlignItems = "CENTER"; // Center align vertically
    container.resize(width, 24); // Match badge height for vertical alignment
    container.fills = [];

    const textNode = figma.createText();
    textNode.characters = text;
    textNode.fontSize = 12;
    textNode.fontName = { family: "Inter", style: "Bold" };

    // Load fonts before modifying text properties (matches badge renderer pattern)
    await loadFontsAsync([textNode]);
    textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
    textNode.textAlignHorizontal = "LEFT"; // Explicitly left align text
    textNode.textAlignVertical = "CENTER"; // Center align vertically

    container.appendChild(textNode);
    return container;
  }

  /**
   * Create table header row with "Click-Through" background
   */
  private async createTableHeader(
    id: number,
    platform: string
  ): Promise<FrameNode> {
    // Calculate row width dynamically from schema column widths
    const platformType = platform as Platform;
    const columnWidths = getColumnWidths(platformType);
    const totalColumnWidth = columnWidths.reduce(
      (sum, width) => sum + width,
      0
    );
    const paddingLeft = 12;
    const paddingRight = 12;
    const itemSpacing = 8;
    // Calculate item spacing: (number of columns - 1) gaps between columns
    const totalItemSpacing = (columnWidths.length - 1) * itemSpacing;
    const rowWidth =
      totalColumnWidth + paddingLeft + paddingRight + totalItemSpacing;

    const row = figma.createFrame();
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "FIXED";
    row.counterAxisSizingMode = "FIXED"; // Fixed height for consistent row spacing
    row.primaryAxisAlignItems = "MIN"; // Left align horizontally
    row.counterAxisAlignItems = "CENTER"; // Center align vertically
    row.resize(rowWidth, 32); // Header row height (smaller than data rows)
    row.paddingTop = 8;
    row.paddingBottom = 8;
    row.paddingLeft = paddingLeft;
    row.paddingRight = paddingRight;
    row.itemSpacing = itemSpacing;

    // CRITICAL CHANGE 1: Make the container transparent
    row.fills = [];

    // CRITICAL CHANGE 2: Add a locked background rectangle
    // Create this FIRST so it sits behind the content
    const bg = figma.createRectangle();
    // Match the row's dimensions (accounting for padding)
    bg.resize(rowWidth, 32);
    // Apply the color here instead of on the row
    bg.fills = [{ type: "SOLID", color: { r: 0.82, g: 0.84, b: 0.86 } }];
    // Scale with the row if the row resizes
    bg.constraints = { horizontal: "SCALE", vertical: "SCALE" };
    // LOCK ONLY THIS RECTANGLE - clicks pass through it
    bg.locked = true;

    // Append FIRST, then set absolute positioning (parent must have layoutMode set)
    row.appendChild(bg);
    // Set to Absolute so it doesn't mess up Auto Layout flow
    bg.layoutPositioning = "ABSOLUTE";
    bg.x = 0;
    bg.y = 0;

    // Get label column width from schema (first column)
    const labelColumnWidth = columnWidths[0];
    if (labelColumnWidth === undefined) {
      throw new Error("Invalid column widths");
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
    badgeNum.characters = id.toString();
    badgeNum.fontSize = 14;
    badgeNum.fontName = { family: "Inter", style: "Bold" };

    // Load fonts before modifying text properties (matches badge renderer pattern)
    await loadFontsAsync([badgeNum]);
    badgeNum.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    badgeNum.resize(24, 24);
    badgeNum.x = 0;
    badgeNum.y = 0;
    badgeNum.textAlignHorizontal = "CENTER";
    badgeNum.textAlignVertical = "CENTER";
    badgeContainer.appendChild(badgeNum);

    badgeCell.appendChild(badgeContainer);
    row.appendChild(badgeCell);

    // Add platform-specific header columns
    if (platform === "mobile") {
      // Use Mobile renderer for mobile header columns
      const mobileColumns =
        await this.mobileRenderer.createMobileTableHeaderColumns(
          (text: string, width: number) => this.createHeaderText(text, width)
        );
      for (const column of mobileColumns) {
        row.appendChild(column);
      }
    } else {
      // Use Web renderer for web header column
      const webColumn = await this.webRenderer.createWebTableHeaderColumn(
        (text: string, width: number) => this.createHeaderText(text, width)
      );
      row.appendChild(webColumn);
    }

    // CRITICAL CHANGE 3: DO NOT lock the row frame
    // The background rectangle is locked, which allows clicks to pass through
    // Text and other content remain clickable

    return row;
  }

  /**
   * Create a mobile table row (delegates to Mobile renderer)
   */
  private async createTableRow(
    label: string,
    ios: string,
    android: string,
    bold: boolean = false
  ): Promise<FrameNode> {
    return await this.mobileRenderer.createTableRow(label, ios, android, bold);
  }

  /**
   * Create a web table row (delegates to Web renderer)
   */
  private async createWebTableRow(
    label: string,
    value: string
  ): Promise<FrameNode> {
    return await this.webRenderer.createWebTableRow(label, value);
  }

  /**
   * Update table content (in-place update or recreate)
   */
  private async updateTableContent(
    table: FrameNode,
    ann: Annotation
  ): Promise<void> {
    // Fonts are loaded by platform renderers or createHeaderText, so we don't need to load them here globally
    // This reduces unnecessary async calls and potential race conditions

    // Expected row order based on platform (from schema)
    const expectedRows = getTableRows(ann);

    // Skip header (index 0) - update rows starting from index 1
    const existingRows = table.children.slice(1); // Skip header

    // Check if structure matches (same number of rows and platform)
    let structureMatches =
      existingRows.length === expectedRows.length && existingRows.length > 0;

    if (structureMatches) {
      // FAST PATH: Update text nodes in place
      try {
        // Batch load fonts for all text nodes
        const allTextNodes = table.findAll(
          (n) => n.type === "TEXT"
        ) as TextNode[];
        await loadFontsAsync(allTextNodes);

        // Handle mobile platform updates using Mobile renderer
        // Support asymmetric rows - include rows with either ios or android (or both)
        if (ann.platform === "mobile" && ann.mobile) {
          // Remove strict filter - allow rows with only ios, only android, or both
          const mobileRows = expectedRows.filter(
            (r) => r.label && (r.ios !== undefined || r.android !== undefined)
          );
          const updated = await this.mobileRenderer.updateMobileTableRows(
            table,
            ann,
            mobileRows
          );
          if (!updated) {
            structureMatches = false;
          }
        } else if (ann.platform === "web" && ann.web) {
          // Use Web renderer for web table updates
          const webRows = expectedRows.filter(
            (r): r is { label: string; value: string } => "value" in r
          );
          const updated = await this.webRenderer.updateWebTableRows(
            table,
            ann,
            webRows
          );
          if (!updated) {
            structureMatches = false;
          }
        }
      } catch (error) {
        Logger.warn("Table update", "Failed in-place update, will recreate", {
          error,
        });
        structureMatches = false;
      }
    }

    if (!structureMatches) {
      // FALLBACK: Recreate if structure changed (platform switch, etc.)
      table.children.forEach((child) => child.remove());

      // Recreate header
      table.appendChild(await this.createTableHeader(ann.id, ann.platform));

      // Recreate rows
      if (ann.platform === "mobile" && ann.mobile) {
        // Use Mobile renderer for mobile table rows
        const mobileRows = await this.mobileRenderer.createMobileTableRows(ann);
        for (const row of mobileRows) {
          table.appendChild(row);
        }
      } else if (ann.platform === "web" && ann.web) {
        // Use Web renderer for web table rows
        const webRows = await this.webRenderer.createWebTableRows(ann);
        for (const row of webRows) {
          table.appendChild(row);
        }
      }
    }
  }

  /**
   * Deterministically calculate table height based on annotation data.
   * This allows us to stack tables correctly during parallel batch creation
   * without needing to read DOM properties or wait for rendering.
   *
   * IMPORTANT: Must match the filtering logic used in updateTableContent and renderers
   * to ensure calculated height matches actual rendered height.
   *
   * NOTE: This method is only used in legacy mode (when containers are not used).
   * Container-based positioning uses auto-layout which handles height automatically.
   *
   * @param ann - Annotation data
   * @returns Projected height in pixels
   */
  private calculateProjectedHeight(ann: Annotation): number {
    // 1. Base container overhead (padding + header)
    let height = TABLE_PADDING_Y + HEADER_HEIGHT;

    // 2. Calculate row count using schema AND filter for active rows
    // We must match the filtering logic used in updateTableContent exactly
    const allPotentialRows = getTableRows(ann);
    let activeRowCount = 0;

    if (ann.platform === "mobile" && ann.mobile) {
      // Filter: Row must have a label AND (ios OR android content)
      // This matches updateTableContent line 444-446
      activeRowCount = allPotentialRows.filter(
        (r) => r.label && (r.ios !== undefined || r.android !== undefined)
      ).length;
    } else if (ann.platform === "web" && ann.web) {
      // Filter: Row must have a label AND value
      // This matches createWebTableRows line 80 and updateTableContent line 457-459
      activeRowCount = allPotentialRows.filter(
        (r) => r.label && "value" in r && r.value !== undefined
      ).length;
    }

    // 3. Add row height (activeRowCount * fixed data row height)
    height += activeRowCount * DATA_ROW_HEIGHT;

    return height;
  }

  /**
   * Get bounds of all existing annotation tables on the current page
   *
   * NOTE: This method is only used in legacy mode (when containers are not used).
   * Container-based positioning uses auto-layout which handles collision avoidance automatically.
   *
   * @param excludeAnnotationId - Optional annotation ID to exclude (when updating existing table)
   * @returns Array of rectangles representing existing table bounds
   */
  private getAllAnnotationTableBounds(
    excludeAnnotationId?: number
  ): Rectangle[] {
    const bounds: Rectangle[] = [];

    // Find all annotation tables on the current page
    // Use name matching as primary method for performance (avoid reading plugin data for every node)
    const tables = figma.currentPage.findAll(
      (node) =>
        node.type === "FRAME" && node.name.startsWith("Annotation Table ")
    ) as FrameNode[];

    for (const table of tables) {
      // If we need to exclude a specific annotation, check both name and plugin data
      if (excludeAnnotationId !== undefined) {
        // First try name-based check (fast path)
        if (table.name.includes(`Annotation Table ${excludeAnnotationId} -`)) {
          continue;
        }

        // Fallback: check plugin data in case name was changed
        const metadata = this.readTableMetadata(table);
        if (metadata && metadata.annotationId === excludeAnnotationId) {
          continue;
        }
      }

      bounds.push({
        x: table.x,
        y: table.y,
        width: table.width,
        height: table.height,
      });
    }

    Logger.debug("Collision avoidance", "Found existing annotation tables", {
      count: bounds.length,
      excludeAnnotationId,
    });

    return bounds;
  }

  /**
   * Calculate X position for table column based on frame's right edge
   * Tables are positioned relative to the frame's bounding box
   * @param frameId - Frame ID to get bounding box for
   * @returns X coordinate for table column, or null if frame not found
   */
  private async calculateTableColumnX(frameId: string): Promise<number | null> {
    try {
      const frame = await figma.getNodeByIdAsync(frameId);
      if (
        !frame ||
        frame.removed ||
        (frame.type !== "FRAME" && frame.type !== "SECTION")
      ) {
        Logger.warn("Table column X", "Frame not found or invalid", {
          frameId,
        });
        return null;
      }

      const bounds = computeBoundingBox(frame as SceneNode);
      const columnX = bounds.x + bounds.width + FRAME_TO_TABLE_GAP;

      Logger.debug("Table column X", "Calculated column position", {
        frameId,
        frameWidth: bounds.width,
        columnX,
      });

      return columnX;
    } catch (error) {
      Logger.error("Table column X", error, { frameId });
      return null;
    }
  }

  /**
   * Create annotation table on canvas using atomic transaction
   * If any step fails (e.g., font loading), all created nodes are cleaned up.
   * @param ann - Annotation data
   * @param target - Target element node
   * @param frameAnnotations - All annotations for the same frame (for Y stacking by ID)
   * @param container - Optional container to insert table into (skips manual positioning)
   */
  async createAnnotationTable(
    ann: Annotation,
    target: SceneNode,
    frameAnnotations: Annotation[] = [],
    container?: FrameNode
  ): Promise<FrameNode> {
    // PERFORMANCE: Track canvas insert operation time
    const perfId = `canvas-insert-${ann.id}`;
    benchmark.start(perfId);

    try {
      // Use transaction wrapper for atomic table creation
      // All nodes are created inside an invisible draft group
      // On success: nodes are committed and made visible
      // On failure: entire draft group is deleted (no orphans)
      const table = await withTransaction(
        {
          name: `Annotation Table ${ann.id}`,
          parentNode: figma.currentPage,
        },
        async (context) => {
          // Calculate container width dynamically from schema column widths
          const platformType = ann.platform;
          const columnWidths = getColumnWidths(platformType);
          const totalColumnWidth = columnWidths.reduce(
            (sum, width) => sum + width,
            0
          );
          const rowPaddingLeft = 12;
          const rowPaddingRight = 12;
          const rowItemSpacing = 8;
          const totalRowItemSpacing =
            (columnWidths.length - 1) * rowItemSpacing;
          const rowWidth =
            totalColumnWidth +
            rowPaddingLeft +
            rowPaddingRight +
            totalRowItemSpacing;

          const containerPaddingLeft = 16;
          const containerPaddingRight = 16;
          const containerWidth =
            rowWidth + containerPaddingLeft + containerPaddingRight;

          const tableFrame = figma.createFrame();
          tableFrame.name = `Annotation Table ${ann.id} - ${ann.frameId}`;
          tableFrame.layoutMode = "VERTICAL";
          tableFrame.primaryAxisSizingMode = "AUTO";
          tableFrame.counterAxisSizingMode = "FIXED";
          tableFrame.resize(containerWidth, 100);
          tableFrame.paddingTop = 16;
          tableFrame.paddingBottom = 16;
          tableFrame.paddingLeft = containerPaddingLeft;
          tableFrame.paddingRight = containerPaddingRight;
          tableFrame.itemSpacing = 0;
          tableFrame.fills = [
            { type: "SOLID", color: { r: 0.95, g: 0.95, b: 0.95 } },
          ];
          tableFrame.cornerRadius = 8;
          tableFrame.strokeWeight = 1;
          tableFrame.strokes = [
            { type: "SOLID", color: { r: 0.82, g: 0.84, b: 0.86 } },
          ];

          // Add table to draft group (invisible during construction)
          context.draftGroup.appendChild(tableFrame);

          // Store table metadata IMMEDIATELY after creating table
          // This prevents race conditions where text change events fire during row creation
          await this.storeTableMetadata(
            tableFrame,
            ann.frameId,
            ann.id,
            1, // Table metadata version
            ann.updatedAt,
            ann.elementId
          );

          // Create and append header (may trigger font loading)
          tableFrame.appendChild(
            await this.createTableHeader(ann.id, ann.platform)
          );

          // Create and append rows based on platform
          if (ann.platform === "mobile" && ann.mobile) {
            const mobileRows = await this.mobileRenderer.createMobileTableRows(
              ann
            );
            for (const row of mobileRows) {
              tableFrame.appendChild(row);
            }
          } else if (ann.platform === "web" && ann.web) {
            const webRows = await this.webRenderer.createWebTableRows(ann);
            for (const row of webRows) {
              tableFrame.appendChild(row);
            }
          }

          // Position table: Skip manual positioning if container is provided
          if (!container) {
            // Legacy positioning: Position table in column to the right of the frame
            const columnX = await this.calculateTableColumnX(ann.frameId);
            if (columnX === null) {
              const bounds = computeBoundingBox(target);
              tableFrame.x = bounds.x + bounds.width + FRAME_TO_TABLE_GAP;
              Logger.warn(
                "Table positioning",
                "Using fallback positioning (element-relative)",
                {
                  annotationId: ann.id,
                }
              );
            } else {
              tableFrame.x = columnX;
            }

            // Vertical stacking: Deterministic ordering by annotation ID
            const allAnnotationsForFrame = [...frameAnnotations, ann].sort(
              (a, b) => a.id - b.id
            );
            const myIndex = allAnnotationsForFrame.findIndex(
              (a) => a.id === ann.id
            );

            const frameBounds = await (async () => {
              const frame = await figma.getNodeByIdAsync(ann.frameId);
              if (
                frame &&
                !frame.removed &&
                (frame.type === "FRAME" || frame.type === "SECTION")
              ) {
                return computeBoundingBox(frame as SceneNode);
              }
              return computeBoundingBox(target);
            })();

            let yOffset = 0;
            if (myIndex > 0) {
              for (let i = 0; i < myIndex; i++) {
                const annotation = allAnnotationsForFrame[i];
                if (!annotation) continue;
                const siblingHeight = this.calculateProjectedHeight(annotation);
                yOffset += siblingHeight + GAP_HEIGHT;
              }
            }

            tableFrame.y = frameBounds.y + yOffset;

            // Collision avoidance
            const existingTableBounds = this.getAllAnnotationTableBounds(
              ann.id
            );
            const projectedHeight = this.calculateProjectedHeight(ann);

            const initialRect: Rectangle = {
              x: tableFrame.x,
              y: tableFrame.y,
              width: containerWidth,
              height: projectedHeight,
            };

            const finalRect = findNonOverlappingPosition(
              initialRect,
              existingTableBounds,
              20
            );
            tableFrame.y = finalRect.y;

            if (finalRect.y !== initialRect.y) {
              Logger.debug(
                "Collision avoidance",
                "Table position adjusted to avoid overlap",
                {
                  annotationId: ann.id,
                  originalY: initialRect.y,
                  adjustedY: finalRect.y,
                  nudgeAmount: finalRect.y - initialRect.y,
                }
              );
            }

            // Update metadata with final position
            await this.storeTableMetadata(
              tableFrame,
              ann.frameId,
              ann.id,
              1,
              ann.updatedAt,
              ann.elementId
            );
          }

          return tableFrame;
        }
      );

      // After successful commit, insert table into container if provided
      if (container) {
        this.insertTableIntoContainer(table, container, ann.id);
      }

      // PERFORMANCE: Complete canvas insert timing on success
      benchmark.stop(perfId, PERFORMANCE_THRESHOLDS.CANVAS_INSERT);
      return table;
    } catch (error) {
      // PERFORMANCE: Complete canvas insert timing on error
      benchmark.stop(perfId, PERFORMANCE_THRESHOLDS.CANVAS_INSERT);

      Logger.error(
        "Create table",
        "Transaction failed - all nodes cleaned up",
        {
          annotationId: ann.id,
          frameId: ann.frameId,
          error,
        }
      );

      throw error;
    }
  }

  /**
   * Update annotation table on canvas
   * @param ann - Annotation to update
   * @param target - Target element node
   * @param frameAnnotations - All annotations for the same frame (for Y stacking)
   */
  async updateAnnotationTable(
    ann: Annotation,
    target: SceneNode,
    frameAnnotations: Annotation[] = []
  ): Promise<void> {
    try {
      const tableName = `Annotation Table ${ann.id} - ${ann.frameId}`;
      const existingTable = figma.currentPage.findOne(
        (node) => node.name === tableName
      ) as FrameNode;

      if (existingTable) {
        // Update existing table content
        await this.updateTableContent(existingTable, ann);

        // Update X position to use frame-relative column layout
        const columnX = await this.calculateTableColumnX(ann.frameId);
        if (columnX !== null) {
          // Update X only if significantly different (>10px threshold)
          if (Math.abs(existingTable.x - columnX) > 10) {
            existingTable.x = columnX;
          }
        } else {
          // Fallback to element-relative positioning if frame lookup fails
          const bounds = computeBoundingBox(target);
          const targetX = bounds.x + bounds.width + FRAME_TO_TABLE_GAP;
          if (Math.abs(existingTable.x - targetX) > 10) {
            existingTable.x = targetX;
          }
        }

        // Update Y position for deterministic stacking by annotation ID
        const sortedAnnotations = frameAnnotations.sort((a, b) => a.id - b.id);
        const myIndex = sortedAnnotations.findIndex((a) => a.id === ann.id);

        if (myIndex >= 0) {
          const frameBounds = await (async () => {
            const frame = await figma.getNodeByIdAsync(ann.frameId);
            if (
              frame &&
              !frame.removed &&
              (frame.type === "FRAME" || frame.type === "SECTION")
            ) {
              return computeBoundingBox(frame as SceneNode);
            }
            return computeBoundingBox(target);
          })();

          let yOffset = 0;
          for (let i = 0; i < myIndex; i++) {
            const annotation = sortedAnnotations[i];
            if (!annotation) continue;
            const siblingHeight = this.calculateProjectedHeight(annotation);
            yOffset += siblingHeight + GAP_HEIGHT;
          }

          const targetY = frameBounds.y + yOffset;
          if (Math.abs(existingTable.y - targetY) > 10) {
            existingTable.y = targetY;
          }
        }

        // Update plugin data with current version and timestamp (authoritative)
        // CRITICAL: Always ensure metadata exists - if missing, write it immediately
        try {
          const existingMetadata = this.readTableMetadata(existingTable);
          const shouldUpdateMetadata =
            !existingMetadata ||
            existingMetadata.sourceFrameId !== ann.frameId ||
            existingMetadata.timestamp !== ann.updatedAt ||
            existingMetadata.position?.elementId !== ann.elementId;

          if (shouldUpdateMetadata) {
            await this.storeTableMetadata(
              existingTable,
              ann.frameId,
              ann.id,
              1, // Table metadata version (separate from annotation version)
              ann.updatedAt,
              ann.elementId
            );
            Logger.debug("Table update", "Updated table metadata", {
              id: ann.id,
              timestamp: ann.updatedAt,
              wasMissing: !existingMetadata,
            });
          }
        } catch (error) {
          // CRITICAL: If metadata is missing and write fails, this is a serious issue
          // Log as error and re-throw to prevent tables without metadata
          const existingMetadata = this.readTableMetadata(existingTable);
          if (!existingMetadata) {
            Logger.error(
              "Table update",
              "CRITICAL: Failed to write metadata to table without metadata - table will be untracked",
              {
                annotationId: ann.id,
                tableId: existingTable.id,
                error,
              }
            );
            // Re-throw to prevent orphaned table without metadata
            throw new Error(
              `Failed to write metadata to table ${existingTable.id}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          } else {
            // If metadata exists but update failed, log warning but continue
            // (table still has metadata, just not updated)
            Logger.warn("Table update", "Failed to update table metadata", {
              annotationId: ann.id,
              error,
            });
          }
        }

        Logger.debug("Table update", "Updated existing table", { id: ann.id });
      } else {
        // Create new table if it doesn't exist (edge case: user manually deleted table)
        // Pass frameAnnotations to ensure proper positioning in column
        // Collision avoidance will still work because createAnnotationTable
        // queries all existing tables on the canvas and applies the nudge algorithm.
        await this.createAnnotationTable(ann, target, frameAnnotations);
        Logger.debug("Table update", "Created new table (zombie recovery)", {
          id: ann.id,
        });
      }
    } catch (error) {
      Logger.error("Table update", error, {
        annotationId: ann.id,
        frameId: ann.frameId,
      });
      throw error; // Re-throw to allow calling code to handle
    }
  }

  /**
   * Cleanup canvas artifacts (badge and table) for a specific annotation
   * Uses name-based lookup to catch even metadata-less "zombies"
   * This is the centralized source of truth for annotation artifact deletion
   * @param ann - Annotation to clean up artifacts for
   */
  deleteAnnotationArtifacts(ann: Annotation): void {
    try {
      // Centralized naming convention (matches createAnnotationTable and createAnnotationBadge)
      const tableName = `Annotation Table ${ann.id} - ${ann.frameId}`;
      const badgeName = `Annotation Badge ${ann.id} - ${ann.frameId}`;

      // Try to find container first (container-based deletion)
      const containerName = `${CONTAINER_NAME_PREFIX} - ${ann.frameId}`;
      const container = figma.currentPage.findOne(
        (node) => node.name === containerName && node.type === "FRAME"
      ) as FrameNode | null;

      if (container && !container.removed) {
        // Container-based deletion: Remove from container columns
        const badgeColumn = this.getBadgeColumn(container);
        const tableColumn = this.getTableColumn(container);

        // Remove badge from badge column
        if (badgeColumn) {
          const badge = badgeColumn.findOne((node) => node.name === badgeName);
          if (badge) {
            badge.remove();
          }
        }

        // Remove table from table column
        if (tableColumn) {
          const table = tableColumn.findOne(
            (node) => node.name === tableName && node.type === "FRAME"
          ) as FrameNode | null;
          if (table) {
            table.remove();
          }
        }

        // Clean up container if empty (no badges or tables remaining)
        const badgeColumnEmpty =
          !badgeColumn || badgeColumn.children.length === 0;
        const tableColumnEmpty =
          !tableColumn || tableColumn.children.length === 0;

        if (badgeColumnEmpty && tableColumnEmpty) {
          container.remove();
          Logger.debug("Canvas cleanup", "Removed empty container", {
            frameId: ann.frameId,
          });
        }

        Logger.debug(
          "Canvas cleanup",
          "Deleted annotation artifacts from container",
          {
            annotationId: ann.id,
            frameId: ann.frameId,
          }
        );
      } else {
        // Legacy mode: Find nodes by name pattern (works even if metadata is missing - "zombie hunter")
        const nodesToDelete = figma.currentPage.findAll(
          (node) => node.name === tableName || node.name === badgeName
        );

        // Delete all found nodes
        nodesToDelete.forEach((node) => node.remove());

        Logger.debug(
          "Canvas cleanup",
          "Deleted annotation artifacts (legacy mode)",
          {
            annotationId: ann.id,
            frameId: ann.frameId,
            count: nodesToDelete.length,
          }
        );
      }
    } catch (error) {
      // Log but do not throw, so we don't block the UI data deletion
      // Canvas cleanup failure shouldn't prevent store deletion
      Logger.warn("Canvas cleanup", "Failed to remove artifacts", {
        annotationId: ann.id,
        frameId: ann.frameId,
        error,
      });
    }
  }

  /**
   * Create an annotation badge for a target element (delegates to BadgeRenderer)
   * @param num - Badge number (annotation ID)
   * @param frameId - Frame ID for badge naming
   * @param target - Target element to position badge relative to
   * @param frameBounds - Bounds of the root frame for X positioning
   * @param options - Badge positioning options (isFrameTarget, annotationIndex, elementIndex)
   * @param skipPositioning - If true, badge is returned without positioning (for container use)
   */
  createAnnotationBadge(
    num: number,
    frameId: string,
    target: SceneNode,
    frameBounds: Rectangle,
    options: {
      isFrameTarget: boolean;
      annotationIndex: number;
      elementIndex: number;
    },
    skipPositioning: boolean = false
  ): FrameNode {
    return this.badgeRenderer.createBadge(
      num,
      frameId,
      target,
      frameBounds,
      options,
      skipPositioning
    );
  }

  /**
   * Update an existing annotation badge or create a new one (delegates to BadgeRenderer)
   * @param badgeId - Badge ID (annotation ID)
   * @param frameId - Frame ID for badge naming
   * @param target - Target element to position badge relative to
   * @param frameBounds - Bounds of the root frame for X positioning
   * @param options - Badge positioning options (isFrameTarget, annotationIndex, elementIndex)
   * @param container - Optional container to insert new badges into
   */
  updateAnnotationBadge(
    badgeId: number,
    frameId: string,
    target: SceneNode,
    frameBounds: Rectangle,
    options: {
      isFrameTarget: boolean;
      annotationIndex: number;
      elementIndex: number;
    },
    container?: FrameNode
  ): void {
    this.badgeRenderer.updateBadge(
      badgeId,
      frameId,
      target,
      frameBounds,
      options,
      container,
      container ? this.insertBadgeIntoContainer.bind(this) : undefined
    );
  }

  /**
   * Map field path to table cell location(s)
   * Returns null if field path is unknown
   * Note: Returns array because some fields (like voicedPreview) map to multiple cells
   */
  mapFieldPathToCellLocation(
    fieldPath: string,
    platform: "mobile" | "web"
  ): Array<{ rowIndex: number; cellIndex: number }> | null {
    return schemaMapFieldToCell(fieldPath, platform);
  }

  /**
   * Map table cell location to field path
   * Inverse of mapFieldPathToCellLocation
   */
  mapCellLocationToFieldPath(
    rowIndex: number,
    cellIndex: number,
    platform: "mobile" | "web"
  ): string | null {
    return schemaMapCellToField(rowIndex, cellIndex, platform);
  }
}
