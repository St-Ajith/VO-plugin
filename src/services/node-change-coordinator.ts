// ============================================================================
// NODE CHANGE COORDINATOR - Handle all Figma node change events
// ============================================================================
//
// This service coordinates responses to Figma's nodechange events, managing:
// - CREATE, DELETE, and PROPERTY_CHANGE events
// - Annotation table text changes with debouncing
// - Message batching for efficient UI updates
// - Cache management
//
// Extracted from main.ts to reduce file size and improve maintainability.

import { Annotation } from "../types";
import { Logger } from "../utils/logger";
import { AnnotationStore } from "./annotation-store";
import { CanvasService } from "./canvas";
import { MessageBatcher } from "../utils/message-batcher";
import { isAnnotationTable } from "../utils/figma-helpers";
import { commandQueue } from "../utils/command-queue";

/**
 * NodeChangeCoordinator handles all Figma document change events
 * and coordinates updates between the canvas, store, and UI.
 */
export class NodeChangeCoordinator {
  // Debounce timers
  private annotationTableTextChangeTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Debounce constants
  private readonly ANNOTATION_TABLE_TEXT_DEBOUNCE_MS = 500; // Wait 500ms after last text change
  
  // Pending updates tracking
  private pendingTableUpdates = new Set<string>(); // Track tables that need updating (by table ID)
  
  // Cache reference (shared with CanvasService)
  private annotationTableToFrameCache: Map<string, string>;

  constructor(
    private store: AnnotationStore,
    private canvasService: CanvasService,
    private messageBatcher: MessageBatcher,
    annotationTableToFrameCacheRef: Map<string, string>
  ) {
    this.annotationTableToFrameCache = annotationTableToFrameCacheRef;
  }

  /**
   * Main handler for Figma node change events
   * Call this from figma.currentPage.on("nodechange", ...)
   */
  async handleNodeChange(event: NodeChangeEvent): Promise<void> {
    // Skip handling if this is an internal mutation (prevents feedback loops)
    if (commandQueue.isInternalMutation) {
      Logger.debug("NodeChange", "Skipping internal mutation");
      return;
    }

    try {
      const createdNodes: Array<{ id: string; annotation: Annotation }> = [];
      const updatedNodes: Array<{ id: string; annotation: Annotation }> = [];
      const deletedNodeIds: string[] = [];

      Logger.debug("Node change", "Processing node changes", {
        changes: event.nodeChanges.length,
      });

      for (const change of event.nodeChanges) {
        const nodeId = change.node.id;

        switch (change.type) {
          case "CREATE":
            await this.handleCreateChange(nodeId, createdNodes);
            break;

          case "DELETE":
            await this.handleDeleteChange(nodeId, deletedNodeIds);
            break;

          case "PROPERTY_CHANGE":
            await this.handlePropertyChange(change, updatedNodes);
            break;
        }
      }

      // Send batched messages to UI
      if (createdNodes.length > 0) {
        this.messageBatcher.queueMessage(
          "nodes-created",
          { nodes: createdNodes },
          "normal"
        );
      }

      if (updatedNodes.length > 0) {
        this.messageBatcher.queueMessage(
          "nodes-updated",
          { nodes: updatedNodes },
          "normal"
        );
      }

      if (deletedNodeIds.length > 0) {
        this.messageBatcher.queueMessage(
          "nodes-deleted",
          { nodeIds: deletedNodeIds },
          "high" // High priority - deletions need immediate UI update
        );
      }
    } catch (error) {
      Logger.error("Node change coordinator", "Error handling node change", error);
    }
  }


  /**
   * Handle CREATE node changes
   */
  private async handleCreateChange(
    nodeId: string,
    createdNodes: Array<{ id: string; annotation: Annotation }>
  ): Promise<void> {
    // Clear cache when nodes are created (affects table discovery)
    this.store.clearCanvasTableCache();

    // Check if this newly created node has annotation data
    const createdAnnotation = await this.store.getAnnotationFromNode(nodeId);
    if (createdAnnotation) {
      createdNodes.push({ id: nodeId, annotation: createdAnnotation });
      Logger.info("Node change", "Node created with annotation", {
        nodeId,
        annotationId: createdAnnotation.id,
      });
    }

    // Also check if this is a top-level frame that should be added to screens
    // Skip internal scaffolding frames (named "Frame"), annotation tables, and containers
    try {
      const createdNode = await figma.getNodeByIdAsync(nodeId);
      if (
        createdNode &&
        !createdNode.removed &&
        (createdNode.type === "FRAME" || createdNode.type === "SECTION") &&
        createdNode.name !== "Frame" && // Skip internal scaffolding frames
        !createdNode.name.startsWith("Annotation Table") && // Skip annotation tables
        !createdNode.name.startsWith("Annotation Container") // Skip annotation containers
      ) {
        // Only log meaningful frame creations (top-level design frames)
        Logger.debug("Node change", "Frame created", {
          nodeId,
          name: createdNode.name,
        });
      }
    } catch (_error) {
      // Frame node not found or invalid, skip screen update
    }
  }

  /**
   * Handle DELETE node changes
   */
  private handleDeleteChange(
    nodeId: string,
    deletedNodeIds: string[]
  ): Promise<void> {
    // Clear cache when nodes are deleted (affects table discovery)
    this.store.clearCanvasTableCache();

    // Clean up annotation table cache if this was an annotation table
    if (this.annotationTableToFrameCache.has(nodeId)) {
      this.annotationTableToFrameCache.delete(nodeId);
      Logger.debug("Node change", "Removed annotation table from cache", {
        nodeId,
      });
    }

    // Node was deleted - notify UI to remove from cache immediately (no debounce)
    deletedNodeIds.push(nodeId);
    Logger.info("Node change", "Node deleted", { nodeId });
    return Promise.resolve();
  }

  /**
   * Handle PROPERTY_CHANGE node changes
   */
  private async handlePropertyChange(
    change: NodeChange,
    updatedNodes: Array<{ id: string; annotation: Annotation }>
  ): Promise<void> {
    const nodeId = change.node.id;

    // Check if annotation data was added/modified on existing node
    if (change.type === "PROPERTY_CHANGE" && change.properties && change.properties.includes("pluginData")) {
      const updatedAnnotation = await this.store.getAnnotationFromNode(nodeId);
      if (updatedAnnotation) {
        // VERSION COMPARISON: Compare with current store version to prevent unnecessary updates
        // Match by composite key (frameId + id) since IDs are frame-scoped
        const currentAnnotations = this.store.getAll();
        const currentAnnotation = currentAnnotations.find(
          (a) => a.id === updatedAnnotation.id && a.frameId === updatedAnnotation.frameId
        );

        let shouldSendUpdate = true;
        let skipReason = "";

        if (currentAnnotation) {
          // Compare timestamps - only send update if incoming timestamp is newer
          const incomingTimestamp =
            updatedAnnotation.updatedAt || updatedAnnotation.createdAt || 0;
          const currentTimestamp =
            currentAnnotation.updatedAt || currentAnnotation.createdAt || 0;

          if (incomingTimestamp <= currentTimestamp) {
            // Incoming timestamp is older or equal - skip update
            shouldSendUpdate = false;
            skipReason = "timestamp";
          }
        }

        if (shouldSendUpdate) {
          updatedNodes.push({ id: nodeId, annotation: updatedAnnotation });
          Logger.debug(
            "Node change",
            "Annotation data updated on existing node",
            {
              nodeId,
              annotationId: updatedAnnotation.id,
            }
          );
        } else {
          Logger.debug(
            "Node change",
            `Skipping stale annotation update (${skipReason})`,
            {
              nodeId,
              annotationId: updatedAnnotation.id,
            }
          );
        }
      }
    }

    // Handle annotation table text changes (debounced to avoid excessive parsing)
    if (change.type === "PROPERTY_CHANGE" && change.properties && change.properties.includes("characters")) {
      try {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (node && !node.removed && node.type === "TEXT") {
          // Check if this text node is inside an annotation table
          let parent: BaseNode | null = node.parent;
          while (parent) {
            if (isAnnotationTable(parent as SceneNode)) {
              const tableId = parent.id;
              
              // Add to pending updates (debounced)
              this.pendingTableUpdates.add(tableId);
              this.scheduleTableTextUpdate(tableId);
              
              Logger.debug("Node change", "Annotation table text changed (debounced)", {
                tableId,
                textNodeId: nodeId,
              });
              break;
            }
            parent = parent.parent;
          }
        }
      } catch (error) {
        Logger.debug("Node change", "Error checking text node parent", {
          nodeId,
          error,
        });
      }
    }
  }

  /**
   * Schedule annotation table text update (debounced)
   * Parse and update only after user stops typing
   */
  private scheduleTableTextUpdate(_tableId: string): void {
    if (this.annotationTableTextChangeTimeout) {
      clearTimeout(this.annotationTableTextChangeTimeout);
    }

    this.annotationTableTextChangeTimeout = setTimeout(() => {
      void this.flushPendingTableUpdates();
      this.annotationTableTextChangeTimeout = null;
    }, this.ANNOTATION_TABLE_TEXT_DEBOUNCE_MS);
  }

  /**
   * Flush all pending table updates (parse and sync to store)
   */
  private async flushPendingTableUpdates(): Promise<void> {
    if (this.pendingTableUpdates.size === 0) return;

    const tableIds = Array.from(this.pendingTableUpdates);
    this.pendingTableUpdates.clear();

    Logger.info(
      "Table text update",
      `Processing ${tableIds.length} pending table updates`
    );

    const updatedAnnotations: Annotation[] = [];

    for (const tableId of tableIds) {
      try {
        const table = await figma.getNodeByIdAsync(tableId);
        if (!table || table.removed) {
          Logger.debug("Table text update", "Table not found or removed", {
            tableId,
          });
          continue;
        }

        // Parse annotation from table
        const extractedData = await this.canvasService.parseAnnotationFromTable(
          table as FrameNode
        );

        if (!extractedData) {
          Logger.warn("Table text update", "Failed to parse table", {
            tableId,
          });
          continue;
        }

        // Get current annotation from store
        // Match by composite key (frameId + id) since IDs are frame-scoped
        // The extracted data includes frameId from the table metadata
        const currentAnnotation = this.store
          .getAll()
          .find((a) => a.id === extractedData.id && a.frameId === extractedData.frameId);

        if (!currentAnnotation) {
          Logger.warn("Table text update", "Annotation not found in store", {
            annotationId: extractedData.id,
          });
          continue;
        }

        // Merge extracted content into existing annotation (deep merge for nested objects)
        const mobileData = extractedData.mobile
          ? {
              ios: {
                ...currentAnnotation.mobile?.ios,
                ...extractedData.mobile.ios,
              },
              android: {
                ...currentAnnotation.mobile?.android,
                ...extractedData.mobile.android,
              },
            }
          : currentAnnotation.mobile;
        const webData = extractedData.web
          ? {
              ...currentAnnotation.web,
              ...extractedData.web,
            }
          : currentAnnotation.web;
        const updatedAnnotation: Annotation = {
          ...currentAnnotation,
          ...extractedData,
          ...(mobileData && { mobile: mobileData }),
          ...(webData && { web: webData }),
          // Keep existing metadata but update timestamps
          updatedAt: Date.now(),
        };

        Logger.debug("Table text update", "Parsed and merged annotation", {
          tableId,
          annotationId: updatedAnnotation.id,
        });

        // Update store
        await this.store.update(updatedAnnotation.id, updatedAnnotation);
        updatedAnnotations.push(updatedAnnotation);
      } catch (error) {
        Logger.error("Table text update", "Error processing table", {
          tableId,
          error,
        });
      }
    }

    // Notify UI of updates using nodes-updated message format
    if (updatedAnnotations.length > 0) {
      const updatedNodes = updatedAnnotations.map((annotation) => ({
        id: annotation.elementId,
        annotation,
      }));
      this.messageBatcher.queueMessage(
        "nodes-updated",
        { nodes: updatedNodes },
        "normal"
      );
      Logger.info(
        "Table text update",
        `Updated ${updatedAnnotations.length} annotations from canvas`
      );
    }
  }

  /**
   * Cleanup resources (call on plugin close)
   */
  cleanup(): void {
    if (this.annotationTableTextChangeTimeout) {
      clearTimeout(this.annotationTableTextChangeTimeout);
      this.annotationTableTextChangeTimeout = null;
    }

    this.pendingTableUpdates.clear();

    Logger.debug("Node change coordinator", "Cleanup complete");
  }
}

