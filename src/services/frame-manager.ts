import { Logger } from "../utils/logger";
import {
  detectTopLevelFrame,
  getAllTopLevelFrames,
  getAllDocumentFrames,
  isAnnotationTable,
} from "../utils/figma-helpers";
import { CanvasService } from "./canvas";
import { AnnotationStore } from "./annotation-store";
import { emitValidated } from "../utils/event-helpers";
import {
  ExpandAnnotationHandler,
} from "../types";

// ============================================================================
// FRAME MANAGER - Centralized frame detection, selection, and navigation
// ============================================================================

export interface Screen {
  id: string;
  name: string;
}

export interface FrameInfo {
  id: string;
  name: string;
  pageId: string;
  pageName: string;
}

export class FrameManager {
  private currentFrameId: string | null = null;
  private selectionScope: "currentPage" | "documentWide" = "currentPage";

  constructor(
    private store: AnnotationStore,
    private canvasService: CanvasService
  ) {}

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  getCurrentFrameId(): string | null {
    return this.currentFrameId;
  }

  getSelectionScope(): "currentPage" | "documentWide" {
    return this.selectionScope;
  }

  setSelectionScope(scope: "currentPage" | "documentWide"): void {
    this.selectionScope = scope;
    Logger.info("Frame manager", "Selection scope changed", scope);
  }

  // ============================================================================
  // FRAME DETECTION
  // ============================================================================

  /**
   * Detect the current frame from the current selection
   */
  detectCurrentFrame(): FrameInfo | null {
    const selection = figma.currentPage.selection;
    if (selection.length === 1) {
      const [firstSelection] = selection;
      if (!firstSelection) return null;
      return detectTopLevelFrame(firstSelection);
    }
    return null;
  }

  /**
   * Get all available frames based on current selection scope
   */
  async getAllAvailableFrames(): Promise<Screen[]> {
    if (this.selectionScope === "documentWide") {
      const documentFrames = await getAllDocumentFrames();
      return documentFrames.map((frame) => ({
        id: frame.id,
        name: `${frame.name} (${frame.pageName})`,
      }));
    } else {
      return getAllTopLevelFrames();
    }
  }

  // ============================================================================
  // FRAME SELECTION AND NAVIGATION
  // ============================================================================

  /**
   * Select a frame and optionally zoom to it
   * @returns The loaded frame node if zoom was performed (for reuse)
   */
  async selectFrame(
    frameId: string | null,
    zoom: boolean = true
  ): Promise<SceneNode | null> {
    this.currentFrameId = frameId;

    if (frameId && zoom) {
      return await this.zoomToFrame(frameId);
    }
    return null;
  }

  /**
   * Switch to a frame (select and navigate)
   */
  async switchToFrame(frameId: string): Promise<void> {
    await this.selectFrame(frameId, true);
  }

  /**
   * Zoom to a frame without changing selection
   * @returns The loaded frame node (for reuse to avoid duplicate getNodeByIdAsync calls)
   */
  async zoomToFrame(frameId: string | null): Promise<SceneNode | null> {
    if (!frameId) {
      frameId = this.currentFrameId;
    }

    if (!frameId) {
      return null;
    }

    try {
      const frame = await figma.getNodeByIdAsync(frameId);
      if (
        frame &&
        !frame.removed &&
        (frame.type === "FRAME" || frame.type === "SECTION")
      ) {
        // If the frame is on a different page, navigate to that page first
        if (
          frame.parent &&
          frame.parent.type === "PAGE" &&
          frame.parent !== figma.currentPage
        ) {
          await figma.setCurrentPageAsync(frame.parent);
        }
        figma.viewport.scrollAndZoomIntoView([frame]);
        Logger.debug("Frame manager", "Zoomed to frame", { frameId });
        return frame as SceneNode;
      }
      return null;
    } catch (error) {
      Logger.error("Frame manager", "Failed to zoom to frame", error);
      throw error;
    }
  }

  // ============================================================================
  // AUTO-SWITCHING LOGIC
  // ============================================================================

  /**
   * Auto-switch to frame based on current selection
   * Handles both normal selections and annotation table selections
   */
  async autoSwitchToFrameWithSelection(): Promise<FrameInfo | null> {
    const selection = figma.currentPage.selection;
    let frameInfo: FrameInfo | null = null;

    if (selection.length === 1) {
      const selectedNode = selection[0];
      if (!selectedNode) return null;

      // Check if selected node is an annotation table
      if (isAnnotationTable(selectedNode)) {
        try {
          const sourceFrameId =
            await this.canvasService.getSourceFrameIdForTable(selectedNode);

          if (sourceFrameId) {
            try {
              const sourceFrame = await figma.getNodeByIdAsync(sourceFrameId);
              if (
                sourceFrame &&
                !sourceFrame.removed &&
                (sourceFrame.type === "FRAME" || sourceFrame.type === "SECTION")
              ) {
                const frameName = sourceFrame.name;
                this.currentFrameId = sourceFrameId;

                // Extract annotation ID from table metadata
                let annotationId: number | null = null;
                if (selectedNode.type === "FRAME") {
                  const tableMetadata = this.canvasService.readTableMetadata(
                    selectedNode
                  );
                  if (tableMetadata) {
                    annotationId = tableMetadata.annotationId;
                  } else {
                    // Fallback: parse from name "Annotation Table {id} - {frameId}"
                    const nameMatch = selectedNode.name.match(
                      /^Annotation Table (\d+) -/
                    );
                    if (nameMatch) {
                      const [, idStr] = nameMatch;
                      if (idStr) {
                        annotationId = parseInt(idStr);
                      }
                    }
                  }
                }

                // Show notification
                figma.notify(`Navigated to source frame: ${frameName}`);

                Logger.info(
                  "Frame manager",
                  "Navigated to source frame from annotation table",
                  {
                    tableId: selectedNode.id,
                    sourceFrameId,
                    frameName,
                    annotationId,
                  }
                );

                // Emit frame auto-switched event
                void emitValidated(
                  "FRAME_AUTO_SWITCHED",
                  {
                    frameId: sourceFrameId,
                    frameName: frameName,
                    annotations: this.store.getByFrame(sourceFrameId),
                  },
                  {
                    frameId: "string",
                    frameName: "string",
                    annotations: "array",
                  }
                );

                // Expand the corresponding annotation accordion in the UI
                if (annotationId !== null) {
                  const { emit } = await import(
                    "@create-figma-plugin/utilities"
                  );
                  emit<ExpandAnnotationHandler>("EXPAND_ANNOTATION", {
                    annotationId,
                  });
                  Logger.debug(
                    "Frame manager",
                    "Expanding annotation accordion",
                    {
                      annotationId,
                    }
                  );
                }

                frameInfo = {
                  id: sourceFrameId,
                  name: frameName,
                  pageId: sourceFrame.parent?.id || "",
                  pageName: sourceFrame.parent?.name || "",
                };
              } else {
                figma.notify("⚠️ Source frame not found");
                Logger.warn("Frame manager", "Source frame not found", {
                  sourceFrameId,
                });
              }
            } catch (error) {
              figma.notify("⚠️ Failed to navigate to source frame");
              Logger.error(
                "Frame manager",
                "Failed to navigate to source frame",
                {
                  sourceFrameId,
                  error,
                }
              );
            }
          } else {
            Logger.warn(
              "Frame manager",
              "Could not determine source frame for annotation table",
              {
                tableId: selectedNode.id,
              }
            );
          }
        } catch (error) {
          Logger.error(
            "Frame manager",
            "Error handling annotation table selection",
            {
              tableId: selectedNode.id,
              error,
            }
          );
        }
      } else {
        // Normal frame detection for non-table selections
        frameInfo = detectTopLevelFrame(selectedNode);

        if (frameInfo && frameInfo.id !== this.currentFrameId) {
          this.currentFrameId = frameInfo.id;
          Logger.info("Frame manager", "Auto-switched to", {
            frame: frameInfo.name,
          });

          void emitValidated(
            "FRAME_AUTO_SWITCHED",
            {
              frameId: frameInfo.id,
              frameName: frameInfo.name,
              annotations: this.store.getByFrame(frameInfo.id),
            },
            { frameId: "string", frameName: "string", annotations: "array" }
          );
        }
      }
    }

    return frameInfo;
  }

  /**
   * Handle selection change and emit appropriate events
   */
  async handleSelectionChange(): Promise<void> {
    const selection = figma.currentPage.selection;
    const frameInfo = await this.autoSwitchToFrameWithSelection();

    void emitValidated(
      "SELECTION_CHANGED",
      {
        count: selection.length,
        frameInfo: frameInfo,
      },
      { count: "number", frameInfo: "object" }
    );
  }
}
