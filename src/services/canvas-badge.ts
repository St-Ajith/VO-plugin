import { computeBoundingBox } from "@create-figma-plugin/utilities";
import { Logger } from "../utils/logger";
import { type Rectangle } from "../utils/bounds-helpers";
import { type BadgeMetadata } from "../types";

// ============================================================================
// BADGE RENDERER - Annotation badge creation and updates
// ============================================================================

// Badge metadata key for plugin data
const BADGE_METADATA_KEY = "voice_over_annotations_badgeMetadata";

// Badge dimensions and spacing constants
const BADGE_WIDTH = 24;
const BADGE_HEIGHT = 24;
const FRAME_TO_BADGE_GAP = 8; // Gap between frame edge and badge
const BADGE_STACK_GAP = 8; // Vertical gap between stacked badges
const BADGE_SIDE_GAP = 4; // Horizontal gap between side-by-side badges

/**
 * Options for badge positioning
 */
export interface BadgePositionOptions {
  /** Whether the target element is the frame itself (no sub-element selected) */
  isFrameTarget: boolean;
  /** Index of this annotation among frame-level annotations (for Y stacking) */
  annotationIndex: number;
  /** Index of this annotation among annotations on the same sub-element (for X side-by-side) */
  elementIndex: number;
}

export class BadgeRenderer {
  /**
   * Store badge metadata (source frameId, annotationId, version, timestamp) in badge's plugin data
   */
  storeBadgeMetadata(
    badge: FrameNode,
    sourceFrameId: string,
    annotationId: number,
    version: number = 1,
    timestamp: number = Date.now(),
    elementId?: string
  ): void {
    try {
      const metadata: BadgeMetadata = {
        sourceFrameId,
        annotationId,
        version,
        timestamp,
        ...(elementId ? { elementId } : {}),
      };
      badge.setPluginData(BADGE_METADATA_KEY, JSON.stringify(metadata));

      Logger.debug("Badge metadata", "Stored badge metadata", {
        badgeId: badge.id,
        sourceFrameId,
        annotationId,
        version,
        timestamp,
        elementId,
      });
    } catch (error) {
      Logger.error("Badge metadata", "Failed to store badge metadata", {
        badgeId: badge.id,
        sourceFrameId,
        annotationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Read badge metadata from badge's plugin data
   */
  readBadgeMetadata(badge: FrameNode): BadgeMetadata | null {
    try {
      const metadataStr = badge.getPluginData(BADGE_METADATA_KEY);
      if (!metadataStr) {
        return null;
      }
      const metadata = JSON.parse(metadataStr) as BadgeMetadata;
      // Ensure version exists for legacy badges
      if (metadata.version === undefined) {
        metadata.version = 1;
      }
      return metadata;
    } catch (error) {
      Logger.error("Badge metadata", "Failed to read badge metadata", {
        badgeId: badge.id,
        error,
      });
      return null;
    }
  }

  /**
   * Create an annotation badge for a target element
   * Badge is returned without positioning (container handles position via auto-layout)
   * Legacy positioning logic is preserved for backward compatibility when container is not used
   */
  createBadge(
    num: number,
    frameId: string,
    target: SceneNode,
    frameBounds: Rectangle,
    options: BadgePositionOptions,
    skipPositioning: boolean = false
  ): FrameNode {
    const badge = figma.createRectangle();
    badge.resize(BADGE_WIDTH, BADGE_HEIGHT);
    badge.fills = [{ type: "SOLID", color: { r: 0.42, g: 0.45, b: 0.49 } }];
    badge.cornerRadius = 4;

    const text = figma.createText();

    // Fonts are pre-loaded in main.ts, so we don't need to load them here
    // await loadFontsAsync([text]);

    text.characters = num.toString();
    text.fontSize = 14;
    text.fontName = { family: "Inter", style: "Bold" };
    text.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
    text.textAlignHorizontal = "CENTER";
    text.textAlignVertical = "CENTER";
    text.resize(BADGE_WIDTH, BADGE_HEIGHT);

    const frame = figma.createFrame();
    frame.name = `Annotation Badge ${num} - ${frameId}`;
    frame.fills = []; // Transparent background
    frame.clipsContent = false; // Allow content to overflow if needed, though usually not for badges
    frame.layoutMode = "NONE";

    // Frame must be large enough to contain children or auto-resized.
    // For now, matching group behavior: just append children.
    // However, Frames have their own size. A group takes the size of its children.
    // We should probably resize the frame to match the badge size.
    frame.resize(BADGE_WIDTH, BADGE_HEIGHT);

    frame.appendChild(badge);
    frame.appendChild(text);

    // Position text and badge inside the frame relative to frame origin
    // Since badge and text were just created, they are at 0,0 default or need positioning?
    // createRectangle creates at 0,0.
    // If we append them to frame, they are relative to frame.
    // The previous code did `badge.resize` and `text.resize`.
    // It didn't set x/y, so they are at 0,0.
    // So appending them to a frame at 0,0 is fine.

    // NOTE: Badge is NOT appended to any parent here.
    // The caller is responsible for placing the badge in the correct container.
    // This enables proper container-based organization.

    // Rename variable for clarity in rest of function
    const group = frame;

    // Only position if not using container (backward compatibility)
    if (!skipPositioning) {
      // X position: relative to frame's right edge, plus offset for multiple badges on same element
      const elementOffset =
        (options.elementIndex ?? 0) * (BADGE_WIDTH + BADGE_SIDE_GAP);
      group.x =
        frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP + elementOffset;

      // Y position: depends on whether target is frame or sub-element
      if (options.isFrameTarget) {
        // Stack badges vertically from frame's top edge
        group.y =
          frameBounds.y +
          FRAME_TO_BADGE_GAP +
          options.annotationIndex * (BADGE_HEIGHT + BADGE_STACK_GAP);
      } else {
        // Center badge on the target element's height
        const targetBounds = computeBoundingBox(target);
        group.y = targetBounds.y + targetBounds.height / 2 - BADGE_HEIGHT / 2;
      }
    }

    // Store badge metadata for reliable frame association
    this.storeBadgeMetadata(group, frameId, num, 1, Date.now(), target.id);

    return group;
  }

  /**
   * Update an existing annotation badge or create a new one
   * Maintains frame-relative X positioning and context-dependent Y positioning
   * @param container - Optional container to insert new badges into
   * @param insertBadgeIntoContainer - Optional function to insert badge into container with sorted ordering
   */
  updateBadge(
    badgeId: number,
    frameId: string,
    target: SceneNode,
    frameBounds: Rectangle,
    options: BadgePositionOptions,
    container?: FrameNode,
    insertBadgeIntoContainer?: (
      badge: FrameNode,
      container: FrameNode,
      annotationId: number
    ) => void
  ): void {
    try {
      const badgeName = `Annotation Badge ${badgeId} - ${frameId}`;
      const existingBadge = figma.currentPage.findOne(
        (node) => node.name === badgeName
      ) as FrameNode;

      if (existingBadge) {
        // X position: relative to frame's right edge, plus offset for multiple badges on same element
        const elementOffset =
          (options.elementIndex ?? 0) * (BADGE_WIDTH + BADGE_SIDE_GAP);
        const targetX =
          frameBounds.x +
          frameBounds.width +
          FRAME_TO_BADGE_GAP +
          elementOffset;

        // Y position: depends on whether target is frame or sub-element
        let targetY: number;
        if (options.isFrameTarget) {
          // Stack badges vertically from frame's top edge
          targetY =
            frameBounds.y +
            FRAME_TO_BADGE_GAP +
            options.annotationIndex * (BADGE_HEIGHT + BADGE_STACK_GAP);
        } else {
          // Center badge on the target element's height
          const targetBounds = computeBoundingBox(target);
          targetY = targetBounds.y + targetBounds.height / 2 - BADGE_HEIGHT / 2;
        }

        // Update X only if moved significantly (>10px threshold)
        if (Math.abs(existingBadge.x - targetX) > 10) {
          existingBadge.x = targetX;
        }

        // Update Y if moved significantly
        if (Math.abs(existingBadge.y - targetY) > 10) {
          existingBadge.y = targetY;
        }

        // CRITICAL: Update metadata to include elementId (Self-Healing)
        // This ensures old badges get upgraded with elementId for parser
        this.storeBadgeMetadata(
          existingBadge,
          frameId,
          badgeId,
          1,
          Date.now(),
          target.id
        );

        Logger.debug("Badge update", "Updated existing badge", { id: badgeId });
      } else {
        // Create new badge if it doesn't exist
        const badge = this.createBadge(
          badgeId,
          frameId,
          target,
          frameBounds,
          options
        );

        // Place badge in correct parent
        if (container && insertBadgeIntoContainer) {
          // Container mode: Use sorted insertion
          insertBadgeIntoContainer(badge, container, badgeId);
        } else {
          // Legacy mode: Add directly to page
          figma.currentPage.appendChild(badge);
        }

        Logger.debug("Badge update", "Created new badge", { id: badgeId });
      }
    } catch (error) {
      Logger.error("Badge update", error, { badgeId, frameId });
      throw error; // Re-throw to allow calling code to handle
    }
  }
}
