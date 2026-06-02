import { Logger } from "../utils/logger";
import type { Annotation } from "../types";
import { mapCellLocationToFieldPath, getHeaderColumnTexts, type Platform } from "../schema/annotation-fields";

// ============================================================================
// CANVAS PARSER - Parse annotation data from Figma canvas tables
// ============================================================================

// Cache for annotation table ID to source frameId mapping (O(1) lookups)
const annotationTableToFrameCache = new Map<string, string>();

export interface CanvasParserDependencies {
  readTableMetadata: (table: FrameNode) => {
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
  } | null;
  storeTableMetadata: (
    table: FrameNode,
    sourceFrameId: string,
    annotationId: number,
    version?: number,
    timestamp?: number,
    elementId?: string
  ) => Promise<void>;
  getAnnotationById?: (annotationId: number, frameId: string) => Annotation | undefined;
}

export class CanvasParser {
  constructor(private dependencies: CanvasParserDependencies) {}

  /**
   * Get text content from a table cell
   * Since we control table creation, each cell only ever has 1 text node
   */
  private getTextFromCell(cell: FrameNode): Promise<string> {
    try {
      const textNode = cell.findOne(
        (node) => node.type === "TEXT"
      ) as TextNode | null;
      if (textNode) {
        return Promise.resolve(textNode.characters);
      }
    } catch (error) {
      Logger.error("Get text from cell", error, { cellId: cell.id });
    }
    return Promise.resolve("");
  }

  /**
   * Set field value in data object by field path (schema-driven)
   * Handles paths like "voicedPreview", "mobile.ios.label", "web.ariaLabel"
   */
  private setFieldValueByPath(
    data: Partial<Annotation>,
    fieldPath: string,
    value: string,
    _platform: Platform
  ): void {
    if (fieldPath === "voicedPreview") {
      data.voicedPreview = value;
      return;
    }

    const parts = fieldPath.split(".");
    if (parts.length === 3 && parts[0] === "mobile") {
      const subPlatform = parts[1] as "ios" | "android";
      const fieldName = parts[2] as "label" | "value" | "trait" | "hint";

      if (!data.mobile) {
        data.mobile = {
          ios: { label: "", value: "", trait: "", hint: "" },
          android: { label: "", value: "", trait: "", hint: "" },
        };
      }
      if (data.mobile[subPlatform]) {
        data.mobile[subPlatform][fieldName] = value;
      }
    } else if (parts.length === 2 && parts[0] === "web") {
      const fieldName = parts[1] as
        | "ariaLabel"
        | "role"
        | "ariaDescribedBy"
        | "tabIndex";

      if (!data.web) {
        data.web = {
          ariaLabel: "",
          role: "",
          ariaDescribedBy: "",
          tabIndex: "",
        };
      }
      data.web[fieldName] = value;
    }
  }

  /**
   * Helper: Find the visual badge node associated with this table.
   * Scans current page first, then falls back to full document scan.
   */
  private async findBadgeNode(
    annotationId: number,
    frameId: string
  ): Promise<FrameNode | GroupNode | null> {
    const badgeName = `Annotation Badge ${annotationId} - ${frameId}`;
    const isBadge = (node: BaseNode) =>
      node.name === badgeName &&
      (node.type === "GROUP" ||
        node.type === "FRAME" ||
        node.type === "INSTANCE");

    // 1. Fast check: Current Page
    const localBadge = figma.currentPage.findOne(isBadge) as
      | FrameNode
      | GroupNode
      | null;
    if (localBadge) return localBadge;

    // 2. Slow check: Whole Document
    // We must load pages to find badges on other pages.
    try {
      await figma.loadAllPagesAsync();
      // eslint-disable-next-line @figma/figma-plugins/dynamic-page-find-method-advice
      return figma.root.findOne(isBadge) as FrameNode | GroupNode | null;
    } catch (error) {
      Logger.error("Find badge node", "Failed during global search", { error });
      return null;
    }
  }

  /**
   * Helper: resolve element ID using an optimized fallback strategy:
   * 1. Metadata (Fastest)
   * 2. Store/Memory (Fast)
   * 3. Geometry/Badge (Slow)
   */
  private async resolveElementId(
    table: FrameNode,
    annotationId: number,
    frameId: string,
    metadataElementId?: string | null
  ): Promise<{
    id: string;
    name: string;
    source: "metadata" | "store" | "badge";
  } | null> {
    // Strategy 1: Metadata (already passed in)
    if (metadataElementId) {
      return {
        id: metadataElementId,
        name: "Unknown Element",
        source: "metadata",
      };
    }

    // Strategy 2: Store Lookup (Optimization: Check memory before scanning canvas)
    // Use composite key (annotationId + frameId) since IDs are frame-scoped
    if (this.dependencies.getAnnotationById) {
      const storeAnnotation = this.dependencies.getAnnotationById(
        annotationId,
        frameId
      );
      if (storeAnnotation?.elementId) {
        return {
          id: storeAnnotation.elementId,
          name: storeAnnotation.elementName || "Unknown Element",
          source: "store",
        };
      }
    }

    // Strategy 3: Badge Geometry (Expensive fallback)
    const badge = await this.findBadgeNode(annotationId, frameId);
    if (badge) {
      // 3a. Check Badge Metadata (New Strategy)
      try {
        const badgeMetadataStr = badge.getPluginData(
          "voice_over_annotations_badgeMetadata"
        );
        if (badgeMetadataStr) {
          const badgeMetadata = JSON.parse(badgeMetadataStr) as {
            elementId?: string;
          };
          if (badgeMetadata.elementId) {
            return {
              id: badgeMetadata.elementId,
              name: badge.name || "Unknown Element",
              source: "metadata", // Treat badge metadata as metadata source
            };
          }
        }
      } catch (error) {
        Logger.warn("Resolve element ID", "Failed to read badge metadata", {
          error,
        });
      }

      // 3b. Geometry Search
      const badgeElementId = await this.findElementFromBadge(badge, frameId);
      if (badgeElementId) {
        return {
          id: badgeElementId,
          name: badge.name || "Unknown Element",
          source: "badge",
        };
      }
    }

    return null;
  }

  /**
   * Find the original element ID from badge positioning
   */
  private async findElementFromBadge(
    badge: FrameNode | GroupNode,
    targetFrameId?: string
  ): Promise<string | null> {
    try {
      // The badge is positioned relative to the element
      // We'll search for elements near the badge position
      const badgeX = badge.x;
      const badgeY = badge.y;

      // Find the frame this badge belongs to
      let currentNode: BaseNode | null = badge;
      let frame: FrameNode | null = null;

      // TRAVERSAL FIX: Handle Container Architecture
      // Badges are now in: Container -> Badge Column -> Badge
      // We need to find the SOURCE frame (the design frame), not just the parent frame

      // If we have a targetFrameId, try to find that frame directly first
      if (targetFrameId) {
        try {
          const targetFrame = await figma.getNodeByIdAsync(targetFrameId);
          if (targetFrame && targetFrame.type === "FRAME") {
            frame = targetFrame;
          }
        } catch (_e) {
          // Ignore lookup failure
        }
      }

      // Fallback: Traverse parents to find a frame
      if (!frame) {
        while (currentNode && currentNode.parent) {
          const parent: BaseNode & ChildrenMixin = currentNode.parent
          if (parent.type === "FRAME") {
            // Check if this is a "Container" or "Badge Column"
            if (
              parent.name.includes("Annotation Container") ||
              parent.name === "Badge Column"
            ) {
              // Keep going up
              currentNode = parent;
              continue;
            }
            // Found a potential design frame
            frame = parent;
            break;
          } else if (parent.type === "PAGE" || parent.type === "DOCUMENT") {
            // Reached top without finding a frame
            break;
          }
          currentNode = parent;
        }
      }

      if (!frame) return Promise.resolve(null);

      // Look for elements near the badge position within the frame
      // NOTE: If badge is in a separate container, badge coordinates are relative to the container!
      // This geometry check ONLY works if badge is inside the frame (Legacy)
      // OR if we translate coordinates (Complex)
      // Since we are moving to Containers, geometry check fails for Container Badges.
      // WE RELY ON METADATA for Container Badges.
      // This geometry fallback is primarily for Legacy Badges (inside the frame).

      if (badge.parent?.id !== frame.id) {
        // If badge is not direct child of frame, geometry check is unreliable/impossible without complex coordinate mapping
        // Assume failure for container-based badges if metadata is missing.
        return Promise.resolve(null);
      }

      for (const child of frame.children) {
        if (
          child.type === "FRAME" ||
          child.type === "GROUP" ||
          child.type === "RECTANGLE" ||
          child.type === "TEXT"
        ) {
          // Check if this element is near where the badge would be positioned
          const elementRight = child.x + child.width;
          const elementTop = child.y;

          // Badge is typically positioned at elementRight + 16, elementTop
          if (
            Math.abs(badgeX - (elementRight + 16)) < 10 &&
            Math.abs(badgeY - elementTop) < 10
          ) {
            return Promise.resolve(child.id);
          }
        }
      }
    } catch (error) {
      Logger.error("Find element from badge", error);
    }
    return Promise.resolve(null);
  }

  /**
   * Extract annotation data from table cells
   * Optimized: Single-pass, fail-fast, lazy text extraction
   */
  async extractAnnotationDataFromTable(
    table: FrameNode,
    platform: "mobile" | "web"
  ): Promise<Partial<Annotation>> {
    const data: Partial<Annotation> = {};

    try {
      Logger.debug("Extract table data", "Starting extraction", {
        tableId: table.id,
        tableName: table.name,
        platform,
        childrenCount: table.children.length,
      });

      const rows = table.children.filter((child) => child.type === "FRAME");

      // Process each row
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        if (!row) continue;

        const cells = row.children.filter((child) => child.type === "FRAME");

        // Skip header row (index 0) and rows with insufficient cells
        if (rowIndex === 0 || cells.length < 2) {
          continue;
        }

        // Calculate schema row index (Table row 1 -> Schema row 0)
        const actualRowIndex = rowIndex - 1;

        // OPTIMIZED LOOP: Single pass
        for (let cellIndex = 1; cellIndex < cells.length; cellIndex++) {
          // 1. Fail Fast: Check if this cell actually maps to a field
          const fieldPath = mapCellLocationToFieldPath(
            actualRowIndex,
            cellIndex,
            platform
          );

          // Optimization: Skip text extraction for non-mapped cells (e.g. labels)
          if (!fieldPath) continue;

          // 2. Lazy Extraction: Only get text for mapped fields
          // Note: accessing cells[cellIndex] is safe because we are looping on cells.length
          const cell = cells[cellIndex];
          if (!cell) continue;
          const cellValue = await this.getTextFromCell(cell);

          // 3. Safety Guard
          if (cellValue === undefined) continue;

          // 4. Set Value
          this.setFieldValueByPath(data, fieldPath, cellValue, platform);
        }
      }
    } catch (error) {
      Logger.error("Extract table data", error);
    }

    return data;
  }

  /**
   * Parse annotation data from a Figma table frame
   */
  async parseAnnotationFromTable(table: FrameNode): Promise<Annotation | null> {
    try {
      // 1. Extract ID and FrameID from Table Name
      const nameMatch = table.name.match(/Annotation Table (\d+) - (.+)/);
      if (!nameMatch) return null;

      const [, idStr, frameId] = nameMatch;
      if (!idStr || !frameId) return null;
      const id = parseInt(idStr);

      // 2. Validate Frame Existence
      let frame: FrameNode;
      try {
        frame = (await figma.getNodeByIdAsync(frameId)) as FrameNode;
        if (!frame) throw new Error("Frame is null");
      } catch (_error) {
        Logger.warn("Parse table", "Frame not found", {
          frameId,
          tableId: table.id,
        });
        return null;
      }

      // 3. Read Metadata
      const existingMetadata = this.dependencies.readTableMetadata(table);
      const now = Date.now();

      // 4. Resolve Element ID (The Optimized Pipeline)
      const resolved = await this.resolveElementId(
        table,
        id,
        frameId,
        existingMetadata?.position?.elementId
      );

      if (!resolved) {
        // Zombie table: Metadata missing, Store missing, Badge missing.
        Logger.warn(
          "Parse table",
          "Zombie table: elementId not found anywhere",
          {
            tableId: table.id,
            annotationId: id,
          }
        );
        return null;
      }

      // 5. Self-Healing: If we found an ID but it wasn't in the table metadata, save it.
      // This handles "Legacy Tables" and "Partial Metadata" cases uniformly.
      if (!existingMetadata || !existingMetadata.position?.elementId) {
        try {
          const version = existingMetadata?.version ?? 1;
          const timestamp = existingMetadata?.timestamp ?? now;

          await this.dependencies.storeTableMetadata(
            table,
            frameId,
            id,
            version,
            timestamp,
            resolved.id // The ID we found from Store or Badge
          );

          Logger.debug(
            "Parse table",
            `Self-healed table metadata using ${resolved.source}`,
            {
              tableId: table.id,
              elementId: resolved.id,
            }
          );
        } catch (error) {
          Logger.warn(
            "Parse table",
            "Failed to update metadata during self-healing",
            { error }
          );
        }
      }

      // 6. Get Element Name (if possible)
      let elementName = resolved.name;
      if (resolved.source === "metadata" || resolved.source === "store") {
        // Try to refresh name from actual node if we just pulled ID from data
        try {
          const node = await figma.getNodeByIdAsync(resolved.id);
          if (node) elementName = node.name;
        } catch (_e) {
          /* ignore */
        }
      }

      // 7. Detect Platform (Schema check -> Fallback to column count)
      const rows = table.children.filter((child) => child.type === "FRAME");
      let platform: "mobile" | "web" = "web";

      if (rows.length > 0) {
        const headerRow = rows[0];
        if (!headerRow) {
          platform = "web";
        } else {
          const headerCells = headerRow.children.filter(
            (c) => c.type === "FRAME"
          );

          // Schema Check
          const mobileHeaders = getHeaderColumnTexts("mobile");
          const webHeaders = getHeaderColumnTexts("web");
          let detected = false;

          for (let i = 1; i < headerCells.length; i++) {
            const cell = headerCells[i];
            if (!cell) continue;
            const txt = (await this.getTextFromCell(cell)).toLowerCase();
            if (mobileHeaders.some((h) => txt.includes(h.toLowerCase()))) {
              platform = "mobile";
              detected = true;
              break;
            }
            if (webHeaders.some((h) => txt.includes(h.toLowerCase()))) {
              platform = "web";
              detected = true;
              break;
            }
          }

          // Fallback: Column Count
          if (!detected && platform === "web" && headerCells.length >= 3) {
            platform = "mobile";
          }
        }
      }

      // 8. Extract Data
      const annotationData = await this.extractAnnotationDataFromTable(
        table,
        platform
      );
      annotationTableToFrameCache.set(table.id, frameId);

      return {
        id,
        frameId,
        frameName: frame.name,
        pageId: frame.parent?.id || "",
        pageName: frame.parent?.name || "",
        platform,
        elementId: resolved.id,
        elementName: elementName,
        voicedPreview: annotationData.voicedPreview || "",
        targetElementId: annotationData.targetElementId ?? null,
        createdAt: now,
        updatedAt: existingMetadata?.timestamp || now,
        ...annotationData,
      };
    } catch (error) {
      Logger.error("Parse table", error);
      return null;
    }
  }
}
