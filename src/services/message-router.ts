import { on, emit, loadSettingsAsync, saveSettingsAsync, setRelaunchButton, loadFontsAsync, computeBoundingBox } from "@create-figma-plugin/utilities";
import {
  Annotation,
  AnnotationCreatedHandler,
  AnnotationDeletedHandler,
  AnnotationUpdatedHandler,
  AnnotationsReorderedHandler,
  CanvasSyncCompleteHandler,
  CreateAnnotationHandler,
  GenerateFrameHandler,
  DeleteAnnotationHandler,
  GetScreensHandler,
  InsertAnnotationsHandler,
  InsertCompleteHandler,
  NodeChangeMessages,
  ReorderAnnotationHandler,
  ScreensListHandler,
  SelectFrameHandler,
  SetSelectionScopeHandler,
  SwitchPlatformHandler,
  SyncCanvasHandler,
  ToggleAnnotationsHandler,
  UpdateAnnotationHandler,
  UpdateAnnotationsHandler,
  UpdateUserSettingsHandler,
  UserSettings,
  ZoomToFrameHandler,
  SaveDataHandler,
  FieldUpdateRealtimeHandler,
  DeleteDataHandler,
  UpdateAllAnnotationsHandler,
  RequestResyncHandler,
  InitHandler,
} from "../types";
import { Logger } from "../utils/logger";
import { AnnotationStore } from "./annotation-store";
import { CanvasService } from "./canvas";
import { FrameManager } from "./frame-manager";
import { isAnnotationTable } from "../utils/figma-helpers";
import { assembleAnnotation, generateFrameFieldDrafts } from "../utils/annotation-helpers";
import { emitValidated } from "../utils/event-helpers";
import {
  validateNodeForAnnotation,
  validateNodeExists,
} from "../utils/node-helpers";
import { BatchProcessor } from "../utils/batch-processor";
import { detectTopLevelFrame } from "../utils/figma-helpers";
import { commandQueue, CommandType } from "../utils/command-queue";
import { isDuplicateRequest, markRequestProcessed } from "../utils/request-tracker";
import {
  validateSaveDataPayload,
  validateDeleteDataPayload,
  validateAnnotations,
} from "../schema/annotation-schema";
import { circuitBreaker, CircuitBreakerKeys } from "../utils/circuit-breaker";

// ============================================================================
// MESSAGE ROUTER - Centralized message handler management
// ============================================================================

export class MessageRouter {
  constructor(
    private store: AnnotationStore,
    private canvasService: CanvasService,
    private frameManager: FrameManager,
    // Global state references for backward compatibility
    private currentPlatformRef: { value: "mobile" | "web" },
    private selectionScopeRef: { value: "currentPage" | "documentWide" }
  ) {}

  // ============================================================================
  // COMMAND CLASSIFICATION
  // ============================================================================

  /**
   * Classify a message handler by operation type
   */
  private getCommandType(messageName: string): CommandType {
    // MUTATE operations: state-changing operations that must be serialized
    const mutateOperations = [
      "CREATE_ANNOTATION",
      "GENERATE_FRAME",
      "UPDATE_ANNOTATION",
      "DELETE_ANNOTATION",
      "REORDER_ANNOTATION",
      "save-data",
      "delete-data",
      "INSERT_ANNOTATIONS",
      "UPDATE_ANNOTATIONS",
      "update-annotations",
    ];

    if (mutateOperations.includes(messageName)) {
      return CommandType.MUTATE;
    }

    // READ operations: queries that can execute immediately
    return CommandType.READ;
  }

  /**
   * Wrap a handler to route through command queue if it's a MUTATE operation
   */
  private wrapHandler<T>(
    messageName: string,
    handler: () => Promise<T>
  ): () => Promise<T> {
    const commandType = this.getCommandType(messageName);

    if (commandType === CommandType.MUTATE) {
      return async () => {
        return commandQueue.enqueue({
          id: `${messageName}-${Date.now()}-${Math.random()}`,
          type: CommandType.MUTATE,
          name: messageName,
          handler,
          timestamp: Date.now(),
        });
      };
    }

    // READ operations execute immediately
    return handler;
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  private async handleCreateAnnotation(requestId?: string): Promise<void> {
    // Note: Duplicate check and markRequestProcessed now happen in registerAllHandlers
    // before wrapHandler() to prevent queue flooding
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.notify(
        "❌ No element selected. Please select one element to annotate."
      );
      return;
    }

    if (selection.length > 1) {
      figma.notify(
        "❌ Multiple elements selected. Please select exactly one element."
      );
      return;
    }

    const target = selection[0];
    if (!target) return;

    // Special handling: If an annotation table is selected, use its source frame as the target
    let frameInfo: {
      id: string;
      name: string;
      pageId: string;
      pageName: string;
    } | null = null;
    let annotationTarget: SceneNode = target;

    if (isAnnotationTable(target)) {
      const sourceFrameId = await this.canvasService.getSourceFrameIdForTable(
        target
      );

      if (sourceFrameId) {
        try {
          const sourceFrame = await figma.getNodeByIdAsync(sourceFrameId);
          if (
            sourceFrame &&
            !sourceFrame.removed &&
            (sourceFrame.type === "FRAME" || sourceFrame.type === "SECTION")
          ) {
            annotationTarget = sourceFrame as SceneNode;
            frameInfo = {
              id: sourceFrame.id,
              name: sourceFrame.name,
              pageId: sourceFrame.parent?.id || "",
              pageName: sourceFrame.parent?.name || "",
            };
            await this.frameManager.selectFrame(sourceFrameId, false);
          }
        } catch (error) {
          Logger.error(
            "Create annotation",
            "Failed to get source frame from annotation table",
            { tableId: target.id, error }
          );
        }
      }

      if (!frameInfo) {
        figma.notify(
          "❌ Could not determine source frame for annotation table."
        );
        return;
      }
    }

    if (!isAnnotationTable(target)) {
      const validation = validateNodeForAnnotation(target);
      if (!validation.isValid) {
        figma.notify(
          `❌ ${validation.reason}. Please select a different element.`
        );
        return;
      }

      frameInfo = detectTopLevelFrame(target);
      if (!frameInfo) {
        figma.notify("❌ Element must be in a top-level frame");
        return;
      }
    }

    if (!frameInfo) {
      figma.notify("❌ Could not determine frame for annotation");
      return;
    }

    // Only select frame if we didn't already select it for annotation table
    if (!isAnnotationTable(target)) {
      await this.frameManager.selectFrame(frameInfo.id, false);
    }
    const annotationId = this.store.getNextId(frameInfo.id);
    const annotation = assembleAnnotation(
      annotationTarget,
      annotationId,
      this.currentPlatformRef.value,
      frameInfo
    );

    await this.store.add(annotation);

    await emitValidated(
      "ANNOTATION_CREATED",
      {
        annotation: annotation,
        frameId: frameInfo.id,
        requestId,
      },
      { annotation: "object", frameId: "string", requestId: "string" }
    );

    figma.notify(`✅ Annotation ${annotationId} created`);
  }

  /**
   * Auto-generate one annotation per focusable element in a frame, in reading
   * order. Reuses the shared assembler so generated annotations are identical
   * in shape to single-created ones. Populates the store and refreshes the UI;
   * the user then uses the existing Insert button to render canvas tables.
   */
  private async handleGenerateForFrame(frameId?: string): Promise<void> {
    const targetFrameId = frameId || this.frameManager.getCurrentFrameId();
    if (!targetFrameId) {
      figma.notify("❌ Select a frame first to generate annotations.");
      return;
    }

    const frameNode = await figma.getNodeByIdAsync(targetFrameId);
    if (
      !frameNode ||
      frameNode.removed ||
      (frameNode.type !== "FRAME" && frameNode.type !== "SECTION")
    ) {
      figma.notify("❌ Could not find the selected frame.");
      return;
    }

    const frame = frameNode;
    const frameInfo = {
      id: frame.id,
      name: frame.name,
      pageId: frame.parent?.id || "",
      pageName: frame.parent?.name || "",
    };

    await this.frameManager.selectFrame(frame.id, false);

    const drafts = generateFrameFieldDrafts(frame);
    if (drafts.length === 0) {
      figma.notify("No focusable elements found in this frame.");
      return;
    }

    let created = 0;
    for (const { node } of drafts) {
      try {
        const id = this.store.getNextId(frame.id);
        const annotation = assembleAnnotation(
          node,
          id,
          this.currentPlatformRef.value,
          frameInfo
        );
        await this.store.add(annotation);
        created++;
      } catch (error) {
        Logger.warn("Generate frame", "Failed to add generated annotation", {
          nodeId: node.id,
          error,
        });
      }
    }

    // Refresh the UI with the authoritative list (no per-item stale checks).
    const screens = await this.frameManager.getAllAvailableFrames();
    emit<InitHandler>("INIT", {
      annotations: this.store.getAll(),
      screens,
      currentFrameId: frame.id,
      selectionScope: this.selectionScopeRef.value,
    });

    Logger.info("Generate frame", "Generated annotations", {
      frameId: frame.id,
      created,
      candidates: drafts.length,
    });
    figma.notify(`✅ Generated ${created} annotation${created === 1 ? "" : "s"}`);
  }

  private async handleUpdateAnnotations(): Promise<void> {
    const frameId = this.frameManager.getCurrentFrameId();
    if (!frameId) {
      figma.notify("No frame selected");
      return;
    }

    const frameAnnotations = this.store.getByFrame(frameId);
    if (frameAnnotations.length === 0) {
      figma.notify("No annotations to update");
      return;
    }

    Logger.info(
      "Update annotations",
      `Starting update of ${frameAnnotations.length} annotations`
    );

    // Get frame bounds once for all badges
    const frame = await figma.getNodeByIdAsync(frameId);
    if (
      !frame ||
      frame.removed ||
      (frame.type !== "FRAME" && frame.type !== "SECTION")
    ) {
      figma.notify("Frame not found");
      return;
    }
    const frameBounds = computeBoundingBox(frame as SceneNode);

    // Get or create annotation container for this frame
    Logger.debug("Update annotations", "Getting or creating container", {
      frameId,
    });
    const annotationContainer = await this.canvasService.getOrCreateContainer(
      frameId
    );

    // Reposition container if frame moved significantly (>10px threshold)
    await this.canvasService.positionContainerRelativeToFrame(
      annotationContainer,
      frameId
    );

    // Calculate which annotations target the frame itself (for Y stacking)
    // Sort by ID to get deterministic stacking order
    const sortedAnnotations = [...frameAnnotations].sort((a, b) => a.id - b.id);
    const frameTargetAnnotations = sortedAnnotations.filter(
      (ann) => ann.elementId === frameId || ann.targetElementId === frameId
    );

    // Group annotations by their target element for side-by-side placement
    const annotationsByElement = new Map<string, Annotation[]>();
    for (const ann of sortedAnnotations) {
      const targetId = ann.targetElementId || ann.elementId;
      if (!annotationsByElement.has(targetId)) {
        annotationsByElement.set(targetId, []);
      }
      annotationsByElement.get(targetId)!.push(ann);
    }

    let updatedCount = 0;
    for (const ann of frameAnnotations) {
      try {
        const validation = await validateNodeExists(ann.elementId);
        if (!validation.exists || !validation.node) {
          Logger.warn(
            "Update annotations",
            validation.reason || "Element validation failed",
            { elementId: ann.elementId }
          );
          continue;
        }
        const elem = validation.node;

        // Determine if this annotation targets the frame itself
        const isFrameTarget =
          ann.elementId === frameId || ann.targetElementId === frameId;
        // Get the index among frame-target annotations for Y stacking
        const annotationIndex = isFrameTarget
          ? frameTargetAnnotations.findIndex((a) => a.id === ann.id)
          : 0;
        // Get the index among annotations on the same element for side-by-side placement
        const targetId = ann.targetElementId || ann.elementId;
        const sameElementAnnotations = annotationsByElement.get(targetId) || [];
        const elementIndex = sameElementAnnotations.findIndex(
          (a) => a.id === ann.id
        );

        this.canvasService.updateAnnotationBadge(
          ann.id,
          ann.frameId,
          elem,
          frameBounds,
          {
            isFrameTarget,
            annotationIndex,
            elementIndex,
          },
          annotationContainer
        );
        await this.canvasService.updateAnnotationTable(
          ann,
          elem,
          frameAnnotations
        );
        updatedCount++;
      } catch (e) {
        Logger.error("Update annotations", e, { annotationId: ann.id });
      }
    }

    Logger.info("Update annotations", "Completed", {
      total: frameAnnotations.length,
      updated: updatedCount,
      failed: frameAnnotations.length - updatedCount,
    });

    emit<InsertCompleteHandler>("INSERT_COMPLETE");
    figma.notify(`✅ Updated ${updatedCount} annotations`);
  }

  private handleToggleAnnotations(visible: boolean): void {
    const tables = figma.currentPage.findAll((n) =>
      n.name.startsWith("Annotation Table")
    );
    tables.forEach((n) => (n.visible = visible));
    figma.notify(visible ? "Details shown" : "Details hidden");
  }

  /**
   * Handle batch insertion of annotations with progress tracking
   * Moved from main.ts to consolidate message handlers
   */
  private async handleInsertAnnotationsBatched(): Promise<void> {
    const currentFrameId = this.frameManager.getCurrentFrameId();

    if (!currentFrameId) {
      figma.notify("No frame selected");
      return;
    }

    const frameAnnotations = this.store.getByFrame(currentFrameId);
    if (frameAnnotations.length === 0) {
      figma.notify("No annotations");
      return;
    }

    // Get frame bounds for badge positioning
    const frame = await figma.getNodeByIdAsync(currentFrameId);
    if (
      !frame ||
      frame.removed ||
      (frame.type !== "FRAME" && frame.type !== "SECTION")
    ) {
      figma.notify("Frame not found");
      return;
    }
    const frameBounds = computeBoundingBox(frame as SceneNode);

    Logger.info(
      "Insert annotations",
      `Starting insertion of ${frameAnnotations.length} annotations`
    );

    // Pre-load fonts (required before any text operations)

    // Clean up existing annotations for this frame
    // Try container-based cleanup first, fall back to legacy cleanup
    const containerName = `Annotation Container - ${currentFrameId}`;
    const existingContainer = figma.currentPage.findOne(
      (n) => n.name === containerName && n.type === "FRAME"
    ) as FrameNode | null;

    if (existingContainer && !existingContainer.removed) {
      // Container-based cleanup: Remove all children from badge and table columns
      const badgeColumn = existingContainer.children.find(
        (child) => child.type === "FRAME" && child.name === "Badge Column"
      ) as FrameNode | undefined;
      const tableColumn = existingContainer.children.find(
        (child) => child.type === "FRAME" && child.name === "Table Column"
      ) as FrameNode | undefined;

      if (badgeColumn) {
        badgeColumn.children.forEach((child) => child.remove());
      }
      if (tableColumn) {
        tableColumn.children.forEach((child) => child.remove());
      }
    } else {
      // Legacy cleanup: Find and remove standalone badges and tables
      const existing = figma.currentPage.findAll(
        (n) =>
          n.name.includes("Annotation Badge") ||
          n.name.includes("Annotation Table")
      );
      const frameSpecificExisting = existing.filter((n) =>
        n.name.includes(currentFrameId)
      );
      frameSpecificExisting.forEach((n) => n.remove());
    }

    // Pre-validate all annotations
    const validAnnotations: Array<{ annotation: Annotation; node: SceneNode }> =
      [];
    for (const ann of frameAnnotations) {
      try {
        const validation = await validateNodeExists(ann.elementId);
        if (validation.exists && validation.node) {
          validAnnotations.push({ annotation: ann, node: validation.node });
        } else {
          Logger.warn(
            "Insert annotations",
            `Skipping invalid annotation: ${validation.reason}`,
            { elementId: ann.elementId }
          );
        }
      } catch (error) {
        Logger.warn("Insert annotations", "Validation error", {
          annotationId: ann.id,
          error,
        });
      }
    }

    if (validAnnotations.length === 0) {
      figma.notify("❌ No valid annotations to insert");
      return;
    }

    // Get or create annotation container for this frame
    const annotationContainer = await this.canvasService.getOrCreateContainer(
      currentFrameId
    );

    // Reposition container if frame moved significantly (>10px threshold)
    await this.canvasService.positionContainerRelativeToFrame(
      annotationContainer,
      currentFrameId
    );

    // Calculate which annotations target the frame itself (for Y stacking - legacy mode only)
    const sortedValidAnnotations = [...validAnnotations].sort(
      (a, b) => a.annotation.id - b.annotation.id
    );
    const frameTargetAnnotations = sortedValidAnnotations.filter(
      ({ annotation }) =>
        annotation.elementId === currentFrameId ||
        annotation.targetElementId === currentFrameId
    );

    // Group annotations by their target element for side-by-side placement (legacy mode only)
    const annotationsByElement = new Map<
      string,
      Array<{ annotation: Annotation; node: SceneNode }>
    >();
    for (const item of sortedValidAnnotations) {
      const targetId =
        item.annotation.targetElementId || item.annotation.elementId;
      if (!annotationsByElement.has(targetId)) {
        annotationsByElement.set(targetId, []);
      }
      annotationsByElement.get(targetId)!.push(item);
    }

    // Create batch processor
    const batchProcessor = new BatchProcessor(
      this.store.getPluginSettings() ?? undefined
    );

    // Add badge creation operations (higher priority)
    // Badges are created without positioning (container handles it via auto-layout)
    validAnnotations.forEach(({ annotation, node }) => {
      // Determine if this annotation targets the frame itself (for legacy compatibility)
      const isFrameTarget =
        annotation.elementId === currentFrameId ||
        annotation.targetElementId === currentFrameId;
      // Get the index among frame-target annotations for Y stacking (legacy mode)
      const annotationIndex = isFrameTarget
        ? frameTargetAnnotations.findIndex(
            (a) => a.annotation.id === annotation.id
          )
        : 0;
      // Get the index among annotations on the same element for side-by-side placement (legacy mode)
      const targetId = annotation.targetElementId || annotation.elementId;
      const sameElementAnnotations = annotationsByElement.get(targetId) || [];
      const elementIndex = sameElementAnnotations.findIndex(
        (a) => a.annotation.id === annotation.id
      );

      batchProcessor.addOperation(
        `badge-${annotation.id}`,
        async () => {
          // Create badge without positioning (container handles it)
          const badge = this.canvasService.createAnnotationBadge(
            annotation.id,
            annotation.frameId,
            node,
            frameBounds,
            { isFrameTarget, annotationIndex, elementIndex },
            true // skipPositioning = true
          );
          // Insert badge into container's badge column
          this.canvasService.insertBadgeIntoContainer(
            badge,
            annotationContainer,
            annotation.id
          );
          await Promise.resolve(); // Satisfy async requirement
          return badge;
        },
        `Create badge for annotation ${annotation.id}`,
        "high"
      );
    });

    // Add table creation operations (normal priority)
    // Tables are created with container parameter (auto-layout handles positioning)
    validAnnotations.forEach(({ annotation, node }) => {
      batchProcessor.addOperation(
        `table-${annotation.id}`,
        async () => {
          // Get all annotations for the frame (for deterministic column stacking - legacy mode)
          const frameAnnotations = this.store
            .getByFrame(annotation.frameId)
            .filter((a) => a.id !== annotation.id)
            .sort((a, b) => a.id - b.id);
          // Create table with container (skips manual positioning, inserts into container)
          return this.canvasService.createAnnotationTable(
            annotation,
            node,
            frameAnnotations,
            annotationContainer
          );
        },
        `Create table for annotation ${annotation.id}`,
        "normal"
      );
    });

    // Execute batch with progress tracking
    figma.notify(`🔄 Inserting ${validAnnotations.length} annotations...`);

    const startTime = Date.now();
    await batchProcessor.executeBatch((completed, total, currentOp) => {
      Logger.debug(
        "Insert annotations",
        `Progress: ${completed}/${total}: ${currentOp}`
      );
    });

    const duration = Date.now() - startTime;
    const results = batchProcessor.getResults();

    // Count successful annotations (both badge and table must succeed)
    let successfulAnnotations = 0;
    let failedAnnotations = 0;

    for (const { annotation } of validAnnotations) {
      const badgeResult = results.get(`badge-${annotation.id}`);
      const tableResult = results.get(`table-${annotation.id}`);

      if (badgeResult?.success && tableResult?.success) {
        successfulAnnotations++;
        // Emit table created message for UI to remove pending status
        emit(
          "table-created" as keyof NodeChangeMessages,
          {
            annotationId: annotation.id,
          } as NodeChangeMessages["table-created"]
        );
      } else {
        failedAnnotations++;
      }
    }

    // Log results
    Logger.info("Insert annotations", "Completed", {
      total: validAnnotations.length,
      successful: successfulAnnotations,
      failed: failedAnnotations,
      duration,
    });

    // Emit completion event
    emit<InsertCompleteHandler>("INSERT_COMPLETE");

    // Notify user of results
    if (failedAnnotations === 0) {
      figma.notify(
        `✅ Successfully inserted ${successfulAnnotations} annotations (${duration}ms)`
      );
    } else {
      figma.notify(
        `⚠️ Inserted ${successfulAnnotations}/${validAnnotations.length} annotations (${failedAnnotations} failed)`
      );
    }
  }

  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================

  registerAllHandlers(): (() => void)[] {
    const cleanups: (() => void)[] = [];

    // SWITCH_PLATFORM handler
    const cleanupSwitchPlatform = on<SwitchPlatformHandler>(
      "SWITCH_PLATFORM",
      (platform) => {
        this.currentPlatformRef.value = platform;
      }
    );
    cleanups.push(cleanupSwitchPlatform);

    // SET_SELECTION_SCOPE handler
    const cleanupSetSelectionScope = on<SetSelectionScopeHandler>(
      "SET_SELECTION_SCOPE",
      (scope) => {
        this.frameManager.setSelectionScope(scope);
        this.selectionScopeRef.value = scope;
        Logger.info("Selection scope changed", scope);
      }
    );
    cleanups.push(cleanupSetSelectionScope);

    // UPDATE_USER_SETTINGS handler
    const cleanupUpdateUserSettings = on<UpdateUserSettingsHandler>(
      "UPDATE_USER_SETTINGS",
      (data) => {
        void (async () => {
          try {
            Logger.debug("Settings", "Received user settings update from UI", {
              keys: Object.keys(data.settings),
            });
            const defaultSettings: UserSettings = {
              theme: "light",
              selectionScope: "currentPage",
            };
            const currentSettings = await loadSettingsAsync<UserSettings>(
              defaultSettings,
              "userSettings"
            );
            const updatedSettings: UserSettings = {
              ...currentSettings,
              ...data.settings,
            };
            await saveSettingsAsync<UserSettings>(
              updatedSettings,
              "userSettings"
            );
            Logger.info("Settings", "User settings saved successfully", {
              keys: Object.keys(data.settings),
            });
          } catch (error) {
            Logger.error("Settings", "Failed to save user settings", error);
          }
        })();
      }
    );
    cleanups.push(cleanupUpdateUserSettings);

    // SELECT_FRAME handler
    const cleanupSelectFrame = on<SelectFrameHandler>(
      "SELECT_FRAME",
      (frameId) => {
        void (async () => {
          try {
            // Select frame and zoom (user-initiated selection from dropdown)
            await this.frameManager.selectFrame(frameId, true);
          } catch (error) {
            Logger.error("Select frame", error);
          }
        })();
      }
    );
    cleanups.push(cleanupSelectFrame);

    // ZOOM_TO_FRAME handler
    const cleanupZoomToFrame = on<ZoomToFrameHandler>(
      "ZOOM_TO_FRAME",
      (frameId) => {
        void (async () => {
          try {
            await this.frameManager.zoomToFrame(frameId || null);
          } catch (error) {
            Logger.error("Zoom to frame", error);
            figma.notify("❌ Could not find or access the frame");
          }
        })();
      }
    );
    cleanups.push(cleanupZoomToFrame);

    // CREATE_ANNOTATION handler
    const cleanupCreateAnnotation = on<CreateAnnotationHandler>(
      "CREATE_ANNOTATION",
      (data) => {
        void (async () => {
          const requestId = data?.requestId;
          try {
            // Check for duplicate request BEFORE queue placement
            if (isDuplicateRequest(requestId)) {
              Logger.warn("Create annotation", "Duplicate request detected, skipping", {
                requestId,
              });
              return;
            }

            // Mark as processed for deduplication
            markRequestProcessed(requestId);

            const wrappedHandler = this.wrapHandler(
              "CREATE_ANNOTATION",
              async () => {
                await this.handleCreateAnnotation(requestId);
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Create annotation handler", error);
            figma.notify("❌ Failed to create annotation", { error: true });
            // Emit error response with requestId so UI can complete tracking
            if (requestId) {
              emit<AnnotationCreatedHandler>("ANNOTATION_CREATED", {
                annotation: {} as Annotation,
                frameId: "",
                requestId,
              });
            }
          }
        })();
      }
    );
    cleanups.push(cleanupCreateAnnotation);

    // GENERATE_FRAME handler - auto-generate annotations for a whole frame
    const cleanupGenerateFrame = on<GenerateFrameHandler>(
      "GENERATE_FRAME",
      (data) => {
        void (async () => {
          const requestId = data?.requestId;
          try {
            if (isDuplicateRequest(requestId)) {
              Logger.warn("Generate frame", "Duplicate request detected, skipping", {
                requestId,
              });
              return;
            }
            markRequestProcessed(requestId);

            const wrappedHandler = this.wrapHandler(
              "GENERATE_FRAME",
              async () => {
                await this.handleGenerateForFrame(data?.frameId);
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Generate frame handler", error);
            figma.notify("❌ Failed to generate annotations", { error: true });
          }
        })();
      }
    );
    cleanups.push(cleanupGenerateFrame);

    // UPDATE_ANNOTATION handler
    const cleanupUpdateAnnotation = on<UpdateAnnotationHandler>(
      "UPDATE_ANNOTATION",
      (data) => {
        void (async () => {
          const requestId = data.requestId;
          try {
            // Check for duplicate request
            if (isDuplicateRequest(requestId)) {
              Logger.warn("Update annotation", "Duplicate request detected, skipping", {
                requestId,
                annotationId: data.id,
              });
              return;
            }

            // Mark as processed for deduplication
            markRequestProcessed(requestId);

            const wrappedHandler = this.wrapHandler(
              "UPDATE_ANNOTATION",
              async () => {
                // Extract requestId from data before updating
                const { requestId: _, ...updateData } = data;
                await this.store.update(data.id, updateData);
                emit<AnnotationUpdatedHandler>("ANNOTATION_UPDATED", {
                  annotation: updateData,
                  ...(requestId && { requestId }),
                });
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Update annotations handler", error);
            figma.notify("❌ Failed to update annotation", { error: true });
            // Emit error response with requestId so UI can complete tracking
            if (requestId) {
              emit<AnnotationUpdatedHandler>("ANNOTATION_UPDATED", {
                annotation: { id: data.id },
                requestId,
              });
            }
          }
        })();
      }
    );
    cleanups.push(cleanupUpdateAnnotation);

    // DELETE_ANNOTATION handler
    const cleanupDeleteAnnotation = on<DeleteAnnotationHandler>(
      "DELETE_ANNOTATION",
      (id, frameId, requestId) => {
        void (async () => {
          try {
            // Check for duplicate request
            if (isDuplicateRequest(requestId)) {
              Logger.warn("Delete annotation", "Duplicate request detected, skipping", {
                requestId,
                annotationId: id,
              });
              return;
            }

            // Mark as processed for deduplication
            markRequestProcessed(requestId);

            const wrappedHandler = this.wrapHandler(
              "DELETE_ANNOTATION",
              async () => {
                // CRITICAL: Use composite key (frameId + id) when frameId is provided
                const annotation = frameId
                  ? this.store
                      .getAll()
                      .find((a) => a.id === id && a.frameId === frameId)
                  : this.store.getAll().find((a) => a.id === id);
                await this.store.delete(id, frameId);
                emit<AnnotationDeletedHandler>("ANNOTATION_DELETED", { 
                  id,
                  frameId: frameId || annotation?.frameId || '',
                  ...(requestId && { requestId }),
                });

                // Delete canvas elements (badge and table) - delegates to CanvasService
                // Centralized logic ensures naming convention consistency
                // Works even if metadata is missing (zombie hunter: finds by name pattern)
                if (annotation) {
                  this.canvasService.deleteAnnotationArtifacts(annotation);
                }

                await this.handleUpdateAnnotations();

                figma.notify("✅ Annotation deleted");
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Delete annotation handler", error);
            figma.notify("❌ Failed to delete annotation", { error: true });
            // Emit error response with requestId so UI can complete tracking
            const errorRequestId = requestId;
            if (errorRequestId) {
              emit<AnnotationDeletedHandler>("ANNOTATION_DELETED", {
                id,
                frameId: frameId || '',
                requestId: errorRequestId,
              });
            }
          }
        })();
      }
    );
    cleanups.push(cleanupDeleteAnnotation);

    // REORDER_ANNOTATION handler
    const cleanupReorderAnnotation = on<ReorderAnnotationHandler>(
      "REORDER_ANNOTATION",
      (id, direction, requestId) => {
        void (async () => {
          try {
            // Check for duplicate request
            if (isDuplicateRequest(requestId)) {
              Logger.warn("Reorder annotation", "Duplicate request detected, skipping", {
                requestId,
                annotationId: id,
              });
              return;
            }

            // Mark as processed for deduplication
            markRequestProcessed(requestId);

            const wrappedHandler = this.wrapHandler(
              "REORDER_ANNOTATION",
              async () => {
                this.store.reorder(id, direction);
                emit<AnnotationsReorderedHandler>("ANNOTATIONS_REORDERED", {
                  annotations: this.store.getAll(),
                  ...(requestId && { requestId }),
                });

                try {
                  await this.handleUpdateAnnotations();
                  Logger.debug(
                    "Reorder annotation",
                    "Canvas updated with new ordering",
                    { id, direction }
                  );
                } catch (canvasError) {
                  Logger.error(
                    "Reorder annotation",
                    "Canvas update failed",
                    canvasError
                  );
                }

                figma.notify("✅ Annotation reordered");
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Reorder annotation handler", error);
            figma.notify("❌ Failed to reorder annotation", { error: true });
            // Emit error response with requestId so UI can complete tracking
            if (requestId) {
              emit<AnnotationsReorderedHandler>("ANNOTATIONS_REORDERED", {
                annotations: this.store.getAll(),
                requestId,
              });
            }
          }
        })();
      }
    );
    cleanups.push(cleanupReorderAnnotation);

    // INSERT_ANNOTATIONS handler
    const cleanupInsertAnnotations = on<InsertAnnotationsHandler>(
      "INSERT_ANNOTATIONS",
      () => {
        void (async () => {
          try {
            // Check circuit breaker before proceeding
            if (circuitBreaker.isOpen(CircuitBreakerKeys.INSERT_ANNOTATIONS)) {
              const cooldownMs = circuitBreaker.getTimeUntilReset(CircuitBreakerKeys.INSERT_ANNOTATIONS);
              Logger.warn("Insert annotations", "Circuit breaker is open, blocking operation", {
                cooldownMs,
              });
              figma.notify(`⏳ Insert operation paused. Retry in ${Math.ceil(cooldownMs / 1000)}s`);
              return;
            }

            const wrappedHandler = this.wrapHandler(
              "INSERT_ANNOTATIONS",
              async () => {
                try {
                  await this.handleInsertAnnotationsBatched();
                  // Record success on completion
                  circuitBreaker.recordSuccess(CircuitBreakerKeys.INSERT_ANNOTATIONS);
                } catch (error) {
                  // Record failure for circuit breaker
                  circuitBreaker.recordFailure(CircuitBreakerKeys.INSERT_ANNOTATIONS);
                  throw error;
                }
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Insert annotations handler", error);
            figma.notify("❌ Failed to insert annotations", { error: true });
          }
        })();
      }
    );
    cleanups.push(cleanupInsertAnnotations);

    // UPDATE_ANNOTATIONS handler
    const cleanupUpdateAnnotations = on<UpdateAnnotationsHandler>(
      "UPDATE_ANNOTATIONS",
      () => {
        void (async () => {
          try {
            // Check circuit breaker before proceeding
            if (circuitBreaker.isOpen(CircuitBreakerKeys.UPDATE_ANNOTATIONS)) {
              const cooldownMs = circuitBreaker.getTimeUntilReset(CircuitBreakerKeys.UPDATE_ANNOTATIONS);
              Logger.warn("Update annotations", "Circuit breaker is open, blocking operation", {
                cooldownMs,
              });
              figma.notify(`⏳ Update operation paused. Retry in ${Math.ceil(cooldownMs / 1000)}s`);
              return;
            }

            const wrappedHandler = this.wrapHandler(
              "UPDATE_ANNOTATIONS",
              async () => {
                try {
                  await this.handleUpdateAnnotations();
                  // Record success on completion
                  circuitBreaker.recordSuccess(CircuitBreakerKeys.UPDATE_ANNOTATIONS);
                } catch (error) {
                  // Record failure for circuit breaker
                  circuitBreaker.recordFailure(CircuitBreakerKeys.UPDATE_ANNOTATIONS);
                  throw error;
                }
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Update annotations handler", error);
            figma.notify("❌ Failed to update annotations", { error: true });
          }
        })();
      }
    );
    cleanups.push(cleanupUpdateAnnotations);

    // TOGGLE_ANNOTATIONS handler
    const cleanupToggleAnnotations = on<ToggleAnnotationsHandler>(
      "TOGGLE_ANNOTATIONS",
      (visible) => {
        this.handleToggleAnnotations(visible);
      }
    );
    cleanups.push(cleanupToggleAnnotations);

    // GET_SCREENS handler
    const cleanupGetScreens = on<GetScreensHandler>("GET_SCREENS", () => {
      void (async () => {
        const screens = await this.frameManager.getAllAvailableFrames();
        emit<ScreensListHandler>("SCREENS_LIST", { screens });
      })();
    });
    cleanups.push(cleanupGetScreens);

    // SYNC_CANVAS handler
    const cleanupSyncCanvas = on<SyncCanvasHandler>("SYNC_CANVAS", () => {
      void (async () => {
        try {
          Logger.info("Canvas sync", "Manual sync requested");
          // Ignore return value for manual sync (not during initialization)
          await this.store.checkCanvasSync();
          const annotations = this.store.getAll();
          emit<CanvasSyncCompleteHandler>("CANVAS_SYNC_COMPLETE", {
            annotations,
          });
          figma.notify("✅ Canvas sync complete");

          // Set relaunch button on current page for quick access
          try {
            setRelaunchButton(figma.currentPage, "syncCanvas", {
              description:
                "Sync changes made directly in Figma canvas back to the plugin",
            });
          } catch (error) {
            Logger.debug("Sync canvas", "Failed to set relaunch button", {
              error,
            });
          }
        } catch (error) {
          Logger.error("Canvas sync handler", error);
          figma.notify("❌ Canvas sync failed", { error: true });
        }
      })();
    });
    cleanups.push(cleanupSyncCanvas);

    // SAVE_DATA handler
    const cleanupSaveData = on<SaveDataHandler>("save-data", (data) => {
      void (async () => {
        try {
          // Validate payload with Valibot
          const validation = validateSaveDataPayload(data);
          if (!validation.success || !validation.data) {
            Logger.error("Save data", "Invalid payload - validation failed", {
              errors: validation.errors,
            });
            emit("save-data-result" as keyof NodeChangeMessages, {
              success: false,
              error: `Invalid payload: ${validation.errors?.join(", ")}`,
              requestId: data.requestId,
            });
            return;
          }

          const validatedData = validation.data;
          const requestId = validatedData.requestId;
          
          // Check circuit breaker AFTER validation (per spec 4a.2)
          if (circuitBreaker.isOpen(CircuitBreakerKeys.SAVE_DATA)) {
            const cooldownMs = circuitBreaker.getTimeUntilReset(CircuitBreakerKeys.SAVE_DATA);
            Logger.warn("Save data", "Circuit breaker is open, blocking operation", {
              cooldownMs,
              annotationId: validatedData.annotation.id,
            });
            emit("save-data-result" as keyof NodeChangeMessages, {
              success: false,
              error: `Operation paused due to repeated failures. Retry in ${Math.ceil(cooldownMs / 1000)}s`,
              requestId,
            });
            return;
          }
          
          // Check for duplicate request
          if (isDuplicateRequest(requestId)) {
            Logger.warn("Save data", "Duplicate request detected, skipping", {
              requestId,
              annotationId: validatedData.annotation.id,
            });
            return;
          }

          // Mark as processed for deduplication
          markRequestProcessed(requestId);

          const wrappedHandler = this.wrapHandler("save-data", async () => {
            Logger.debug("Sync direction", "Save data requested", {
              annotationId: validatedData.annotation.id,
              requestId,
            });

            try {
              // Check if the node still exists before saving (conflict resolution)
              let node: SceneNode;
              try {
                node = (await figma.getNodeByIdAsync(
                  validatedData.annotation.elementId
                )) as SceneNode;
                if (!node || node.removed) {
                  Logger.warn("Sync direction", "Cannot save to removed node", {
                    nodeId: validatedData.annotation.elementId,
                  });
                  emit("save-data-result" as keyof NodeChangeMessages, {
                    success: false,
                    error: "Node no longer exists",
                    requestId,
                  });
                  return;
                }
              } catch (_error) {
                Logger.warn(
                  "Sync direction",
                  "Cannot save to non-existent node",
                  {
                    nodeId: validatedData.annotation.elementId,
                  }
                );
                emit("save-data-result" as keyof NodeChangeMessages, {
                  success: false,
                  error: "Node no longer exists",
                  requestId,
                });
                return;
              }

              // Save to authoritative node storage
              await this.store.update(validatedData.annotation.id, validatedData.annotation);

              emit("save-data-result" as keyof NodeChangeMessages, {
                success: true,
                requestId,
              });
              Logger.info("Sync direction", "Data saved successfully", {
                annotationId: validatedData.annotation.id,
                requestId,
              });
              
              // Record success for circuit breaker
              circuitBreaker.recordSuccess(CircuitBreakerKeys.SAVE_DATA);
            } catch (error) {
              // Record failure for circuit breaker
              circuitBreaker.recordFailure(CircuitBreakerKeys.SAVE_DATA);
              throw error;
            }
          });
          await wrappedHandler();
        } catch (error) {
          Logger.error("Sync direction", "Save data failed", error);
          emit("save-data-result" as keyof NodeChangeMessages, {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            requestId: data?.requestId,
          });
        }
      })();
    });
    cleanups.push(cleanupSaveData);

    // FIELD_UPDATE_REALTIME handler
    const cleanupFieldUpdateRealtime = on<FieldUpdateRealtimeHandler>(
      "field-update-realtime",
      (data) => {
        void (async () => {
          try {
            // Only process if source is UI (prevent feedback loops)
            if (data.source !== "ui") {
              return;
            }

            Logger.debug("Real-time sync", "Field update requested", {
              annotationId: data.annotationId,
              frameId: data.frameId,
              field: data.field,
            });

            // CRITICAL: Find annotation by composite key (frameId + id) to avoid cross-frame collision
            const annotation = this.store
              .getAll()
              .find(
                (a) => a.id === data.annotationId && a.frameId === data.frameId
              );
            if (!annotation) {
              Logger.warn("Real-time sync", "Annotation not found", {
                annotationId: data.annotationId,
                frameId: data.frameId,
              });
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: "Annotation not found",
              });
              return;
            }

            // Use frameId from data for table name to ensure correct table is updated
            const tableName = `Annotation Table ${data.annotationId} - ${data.frameId}`;
            const table = figma.currentPage.findOne(
              (node) => node.name === tableName
            ) as FrameNode;

            if (!table) {
              Logger.debug(
                "Real-time sync",
                "Table not found (may not be inserted yet)",
                {
                  annotationId: data.annotationId,
                  frameId: data.frameId,
                }
              );
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: "Table not found",
              });
              return;
            }

            // Map field path to table cell location(s)
            const cellLocations = this.canvasService.mapFieldPathToCellLocation(
              data.field,
              annotation.platform
            );
            if (!cellLocations || cellLocations.length === 0) {
              Logger.warn("Real-time sync", "Unknown field path", {
                field: data.field,
                platform: annotation.platform,
              });
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: "Unknown field path",
              });
              return;
            }

            // Find the target text nodes
            const rows = table.children.slice(1) as FrameNode[]; // Skip header

            if (rows.length === 0) {
              Logger.debug(
                "Real-time sync",
                "Table has no data rows yet (still being created), skipping update",
                {
                  tableId: table.id,
                  annotationId: data.annotationId,
                  field: data.field,
                }
              );
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: "Table still being created",
              });
              return;
            }

            const textNodesToUpdate: TextNode[] = [];

            for (const cellLocation of cellLocations) {
              if (cellLocation.rowIndex >= rows.length) {
                Logger.warn("Real-time sync", "Row index out of bounds", {
                  rowIndex: cellLocation.rowIndex,
                  rowCount: rows.length,
                });
                continue;
              }

              const targetRow = rows[cellLocation.rowIndex];
              if (!targetRow) {
                Logger.warn("Real-time sync", "Target row not found", {
                  rowIndex: cellLocation.rowIndex,
                  rowCount: rows.length,
                });
                continue;
              }
              const textNodes = targetRow.findAll(
                (n) => n.type === "TEXT"
              ) as TextNode[];

              const expectedTextNodeCount =
                annotation.platform === "mobile" ? 3 : 2;
              if (textNodes.length !== expectedTextNodeCount) {
                Logger.warn("Real-time sync", "Unexpected text node count", {
                  expected: expectedTextNodeCount,
                  actual: textNodes.length,
                  platform: annotation.platform,
                  rowIndex: cellLocation.rowIndex,
                });
              }

              if (cellLocation.cellIndex >= textNodes.length) {
                Logger.warn("Real-time sync", "Cell index out of bounds", {
                  cellIndex: cellLocation.cellIndex,
                  cellCount: textNodes.length,
                  platform: annotation.platform,
                });
                continue;
              }

              if (cellLocation.cellIndex === 0) {
                Logger.debug("Real-time sync", "Skipping label column update", {
                  field: data.field,
                });
                continue;
              }

              const textNode = textNodes[cellLocation.cellIndex];
              if (textNode) {
                textNodesToUpdate.push(textNode);
              }
            }

            if (textNodesToUpdate.length === 0) {
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: "No valid cells found to update",
              });
              return;
            }

            try {
              await loadFontsAsync(textNodesToUpdate);
              for (const textNode of textNodesToUpdate) {
                textNode.characters = data.value;
              }
              Logger.debug("Real-time sync", "Updated canvas table cell(s)", {
                annotationId: data.annotationId,
                field: data.field,
                cellCount: textNodesToUpdate.length,
              });

              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: true,
              });
            } catch (error) {
              Logger.error(
                "Real-time sync",
                "Failed to update text node",
                error
              );
              emit("field-update-realtime-result" as keyof NodeChangeMessages, {
                annotationId: data.annotationId,
                field: data.field,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          } catch (error) {
            Logger.error("Real-time sync", "Field update failed", error);
            emit("field-update-realtime-result" as keyof NodeChangeMessages, {
              annotationId: data.annotationId,
              field: data.field,
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();
      }
    );
    cleanups.push(cleanupFieldUpdateRealtime);

    // DELETE_DATA handler
    const cleanupDeleteData = on<DeleteDataHandler>("delete-data", (data) => {
      void (async () => {
        try {
          // Validate payload with Valibot
          const validation = validateDeleteDataPayload(data);
          if (!validation.success || !validation.data) {
            Logger.error("Delete data", "Invalid payload - validation failed", {
              errors: validation.errors,
            });
            emit("save-data-result" as keyof NodeChangeMessages, {
              success: false,
              error: `Invalid payload: ${validation.errors?.join(", ")}`,
              requestId: data.requestId,
            });
            return;
          }

          const validatedData = validation.data;
          const requestId = validatedData.requestId;
          
          // Check circuit breaker AFTER validation (per spec 4a.2)
          if (circuitBreaker.isOpen(CircuitBreakerKeys.DELETE_DATA)) {
            const cooldownMs = circuitBreaker.getTimeUntilReset(CircuitBreakerKeys.DELETE_DATA);
            Logger.warn("Delete data", "Circuit breaker is open, blocking operation", {
              cooldownMs,
              annotationId: validatedData.annotationId,
            });
            emit("save-data-result" as keyof NodeChangeMessages, {
              success: false,
              error: `Operation paused due to repeated failures. Retry in ${Math.ceil(cooldownMs / 1000)}s`,
              requestId,
            });
            return;
          }
          
          // Check for duplicate request
          if (isDuplicateRequest(requestId)) {
            Logger.warn("Delete data", "Duplicate request detected, skipping", {
              requestId,
              annotationId: validatedData.annotationId,
            });
            return;
          }

          // Mark as processed for deduplication
          markRequestProcessed(requestId);

          const wrappedHandler = this.wrapHandler("delete-data", async () => {
            Logger.debug("Sync direction", "Delete data requested", {
              annotationId: validatedData.annotationId,
              frameId: validatedData.frameId,
              elementId: validatedData.elementId,
              requestId,
            });

            try {
              // CRITICAL: Get annotation using composite key (frameId + id) to avoid cross-frame collision
              const annotation = this.store
                .getAll()
                .find(
                  (a) => a.id === validatedData.annotationId && a.frameId === validatedData.frameId
                );

              // Check if the node still exists (may have been deleted already)
              let node: SceneNode | undefined;
              try {
                node = (await figma.getNodeByIdAsync(
                  validatedData.elementId
                )) as SceneNode;
                if (!node || node.removed) {
                  Logger.debug(
                    "Sync direction",
                    "Node has been removed, cleaning up cache",
                    {
                      nodeId: validatedData.elementId,
                    }
                  );
                  // Still remove from our cache even if node is gone - use composite key
                  await this.store.delete(validatedData.annotationId, validatedData.frameId);

                  if (annotation) {
                    this.canvasService.deleteAnnotationArtifacts(annotation);
                  }

                  emit("save-data-result" as keyof NodeChangeMessages, {
                    success: true,
                    requestId,
                  });
                  
                  // Record success for circuit breaker
                  circuitBreaker.recordSuccess(CircuitBreakerKeys.DELETE_DATA);
                  return;
                }
              } catch (_error) {
                Logger.debug(
                  "Sync direction",
                  "Node doesn't exist, cleaning up cache",
                  {
                    nodeId: validatedData.elementId,
                  }
                );
                // Use composite key for delete
                await this.store.delete(validatedData.annotationId, validatedData.frameId);

                if (annotation) {
                  this.canvasService.deleteAnnotationArtifacts(annotation);
                }

                emit("save-data-result" as keyof NodeChangeMessages, {
                  success: true,
                  requestId,
                });
                
                // Record success for circuit breaker
                circuitBreaker.recordSuccess(CircuitBreakerKeys.DELETE_DATA);
                return;
              }

              // Delete from authoritative storage using composite key
              await this.store.delete(validatedData.annotationId, validatedData.frameId);

              if (annotation) {
                this.canvasService.deleteAnnotationArtifacts(annotation);
              }

              emit("save-data-result" as keyof NodeChangeMessages, {
                success: true,
                requestId,
              });
              Logger.info("Sync direction", "Data deleted successfully", {
                annotationId: validatedData.annotationId,
                requestId,
              });
              
              // Record success for circuit breaker
              circuitBreaker.recordSuccess(CircuitBreakerKeys.DELETE_DATA);
            } catch (error) {
              // Record failure for circuit breaker
              circuitBreaker.recordFailure(CircuitBreakerKeys.DELETE_DATA);
              throw error;
            }
          });
          await wrappedHandler();
        } catch (error) {
          Logger.error("Sync direction", "Delete data failed", error);
          emit("save-data-result" as keyof NodeChangeMessages, {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            requestId: data?.requestId,
          });
        }
      })();
    });
    cleanups.push(cleanupDeleteData);

    // UPDATE_ANNOTATIONS handler (bulk update)
    const cleanupUpdateAllAnnotations = on<UpdateAllAnnotationsHandler>(
      "update-annotations",
      (data) => {
        void (async () => {
          try {
            const wrappedHandler = this.wrapHandler(
              "update-annotations",
              async () => {
                // Validate annotations array with Valibot
                const { valid: schemaValidAnnotations, invalidCount } = validateAnnotations(
                  data.annotations
                );
                
                if (invalidCount > 0) {
                  Logger.warn(
                    "Sync direction",
                    "Some annotations failed schema validation",
                    {
                      total: data.annotations.length,
                      valid: schemaValidAnnotations.length,
                      invalid: invalidCount,
                    }
                  );
                }

                Logger.debug(
                  "Sync direction",
                  "Update all annotations requested",
                  {
                    count: schemaValidAnnotations.length,
                  }
                );

                // Validate all nodes still exist before bulk update
                const validAnnotations = [];
                for (const annotation of schemaValidAnnotations) {
                  try {
                    const node = await figma.getNodeByIdAsync(
                      annotation.elementId
                    );
                    if (node && !node.removed) {
                      validAnnotations.push(annotation);
                    } else {
                      Logger.warn(
                        "Sync direction",
                        "Skipping update for removed node",
                        {
                          nodeId: annotation.elementId,
                          annotationId: annotation.id,
                        }
                      );
                    }
                  } catch (_error) {
                    Logger.warn(
                      "Sync direction",
                      "Skipping update for non-existent node",
                      {
                        nodeId: annotation.elementId,
                        annotationId: annotation.id,
                      }
                    );
                  }
                }

                // Update the store with valid annotations only
                this.store.setAnnotations(validAnnotations);

                emit("save-data-result" as keyof NodeChangeMessages, {
                  success: true,
                });
                Logger.info("Sync direction", "All annotations updated", {
                  count: validAnnotations.length,
                });
              }
            );
            await wrappedHandler();
          } catch (error) {
            Logger.error("Sync direction", "Update annotations failed", error);
            emit("save-data-result" as keyof NodeChangeMessages, {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        })();
      }
    );
    cleanups.push(cleanupUpdateAllAnnotations);

    // REQUEST_RESYNC handler - SA-03 state recovery
    // UI requests fresh INIT payload when optimistic update fails
    const cleanupRequestResync = on<RequestResyncHandler>(
      "request-resync",
      () => {
        void (async () => {
          try {
            Logger.info("State recovery", "Re-sync requested by UI");

            // Reload annotations from authoritative node storage
            await this.store.load();
            const annotations = this.store.getAll();

            // Get available frames
            const screens = await this.frameManager.getAllAvailableFrames();

            // Emit fresh INIT payload
            emit<InitHandler>("INIT", {
              annotations,
              screens,
              currentFrameId: this.frameManager.getCurrentFrameId(),
              selectionScope: this.selectionScopeRef.value,
            });

            Logger.info("State recovery", "Re-sync complete", {
              annotationCount: annotations.length,
              screenCount: screens.length,
            });
          } catch (error) {
            Logger.error("State recovery", "Re-sync failed", error);
            // Still emit INIT with empty data to clear syncing state
            emit<InitHandler>("INIT", {
              annotations: [],
              screens: [],
              currentFrameId: null,
              selectionScope: this.selectionScopeRef.value,
            });
          }
        })();
      }
    );
    cleanups.push(cleanupRequestResync);

    return cleanups;
  }
}

