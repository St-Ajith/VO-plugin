import {
  emit,
  showUI,
} from "@create-figma-plugin/utilities";

import { NodeChangeMessages } from "./types";

import { Logger } from "./utils/logger";
import { CanvasService } from "./services/canvas";
import { AnnotationStore } from "./services/annotation-store";
import { MessageRouter } from "./services/message-router";
import { FrameManager } from "./services/frame-manager";
import { emitValidated } from "./utils/event-helpers";
import { MessageBatcher } from "./utils/message-batcher";
import { NodeChangeCoordinator } from "./services/node-change-coordinator";
import { benchmark, PERFORMANCE_THRESHOLDS } from "./utils/benchmark";
import { cleanupOrphanedDrafts, notifyOrphanCleanup } from "./utils/transaction-wrapper";

// ============================================================================
// GLOBAL STATE
// ============================================================================

const store = new AnnotationStore();
const canvasService = new CanvasService(store);
const frameManager = new FrameManager(store, canvasService);

// State refs for MessageRouter (managed by FrameManager)
const currentPlatformRef: { value: "mobile" | "web" } = { value: "mobile" };
const currentFrameIdRef: { value: string | null } = { value: null };
const selectionScopeRef: { value: "currentPage" | "documentWide" } = { value: "currentPage" };

// Sync FrameManager state with refs
const syncFrameManagerToRefs = () => {
  currentFrameIdRef.value = frameManager.getCurrentFrameId();
  selectionScopeRef.value = frameManager.getSelectionScope();
};

// Cache for annotation table ID to source frameId mapping (O(1) lookups)
const annotationTableToFrameCache = new Map<string, string>();

// ============================================================================
// MAIN PLUGIN ENTRY POINT
// ============================================================================

export default function () {
  // Initialize
  void (async () => {
    // PERFORMANCE: Track plugin initialization time (PRD requirement: < 2s)
    benchmark.start("plugin-initialization");
    Logger.info("Plugin", "Initializing");

    // Pre-load fonts early to avoid blocking operations during shutdown
    // This ensures fonts are ready when needed and prevents graceful shutdown issues
    try {
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    } catch (error) {
      Logger.warn("Plugin", "Font pre-load failed (non-critical)", error);
      // Continue initialization - fonts will be loaded on-demand if needed
    }

    // Clean up any orphaned transaction drafts from previous sessions
    // These are incomplete operations that were interrupted (e.g., plugin crash, forced close)
    const orphanedDraftCount = cleanupOrphanedDrafts();
    notifyOrphanCleanup(orphanedDraftCount);

    await store.load();

    // Check for changes in the canvas and sync bidirectionally
    // Track which annotations have tables (found on canvas)
    let annotationsWithTables: number[] = [];
    try {
      annotationsWithTables = await store.checkCanvasSync();
    } catch (error) {
      Logger.warn("Plugin", "Canvas sync failed during initialization", error);
      // Continue with initialization even if canvas sync fails
    }

    const screens = await frameManager.getAllAvailableFrames();
    const annotations = store.getAll();
    syncFrameManagerToRefs();

    // Small delay to ensure UI handlers are registered
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Send initial data to UI
    await emitValidated(
      "INIT",
      {
        annotations: annotations,
        screens: screens,
        currentFrameId: frameManager.getCurrentFrameId(),
        selectionScope: frameManager.getSelectionScope(),
      },
      {
        annotations: "array",
        screens: "array",
        currentFrameId: "string | null",
        selectionScope: "string",
      }
    );

    // Send authoritative data to UI via new sync direction messages
    await emitValidated(
      "load-source-of-truth" as keyof NodeChangeMessages,
      {
        annotations: annotations,
        screens: screens,
      },
      { annotations: "array", screens: "array" }
    );

    // Emit TABLE_CREATED for annotations that were found on canvas during sync
    // This ensures UI doesn't mark them as pending (they already have tables)
    // We do this after INIT to ensure UI handlers are registered
    for (const annotationId of annotationsWithTables) {
      emit(
        "table-created" as keyof NodeChangeMessages,
        {
          annotationId: annotationId,
        } as NodeChangeMessages["table-created"]
      );
    }

    if (annotationsWithTables.length > 0) {
      Logger.debug("Plugin", "Emitted TABLE_CREATED for existing annotations", {
        count: annotationsWithTables.length,
      });
    }

    // PERFORMANCE: Complete plugin initialization timing
    const initDuration = benchmark.stop("plugin-initialization", PERFORMANCE_THRESHOLDS.PLUGIN_LOAD);
    
    Logger.info("Plugin", "Ready", {
      annotations: annotations.length,
      screens: screens.length,
      initTime: `${initDuration.toFixed(0)}ms`,
    });
  })().catch((error) => {
    benchmark.stop("plugin-initialization");
    Logger.error("Plugin initialization", error);
  });

  // Selection change handler - now handled by FrameManager
  const selectionChangeHandler = async () => {
    await frameManager.handleSelectionChange();
    syncFrameManagerToRefs();
  };

  figma.on("selectionchange", selectionChangeHandler);

  // Create MessageRouter and register all handlers
  const messageRouter = new MessageRouter(
    store,
    canvasService,
    frameManager,
    currentPlatformRef,
    selectionScopeRef
  );
  messageRouter.registerAllHandlers();

  // ============================================================================
  // NODE CHANGE DETECTION - Real-time sync from Figma to UI
  // ============================================================================

  const messageBatcher = new MessageBatcher();

  const nodeChangeCoordinator = new NodeChangeCoordinator(
    store,
    canvasService,
    messageBatcher,
    annotationTableToFrameCache
  );

  // Listen for real-time node changes in Figma (CREATE, UPDATE, DELETE)
  figma.currentPage.on("nodechange", (event) => {
    void (async () => {
      await nodeChangeCoordinator.handleNodeChange(event);
    })();
  });



  // Show UI
  showUI({
    height: 700,
    width: 600,
  });

  // ============================================================================
  // CLEANUP - Plugin close and resource cleanup
  // ============================================================================

  // Cleanup on plugin close with comprehensive resource management
  // Note: During hot reload, this may be called while new code is loading,
  // so we make it defensive and non-blocking
  const closeHandler = () => {
    try {
      Logger.info("Event cleanup", "Plugin cleanup started");

      // Use a timeout to prevent blocking during hot reload
      const cleanupPromise = (async () => {
        try {
          // Flush any pending batched messages before closing
          if (typeof messageBatcher !== "undefined" && messageBatcher) {
            messageBatcher.flush();
          }

          // Clear NodeChangeCoordinator timers
          if (
            typeof nodeChangeCoordinator !== "undefined" &&
            nodeChangeCoordinator
          ) {
            nodeChangeCoordinator.cleanup();
          }

          // Force final sync to ensure data persistence (only if store is available)
          if (
            typeof store !== "undefined" &&
            store &&
            typeof store.forceSync === "function"
          ) {
            await store.forceSync();
          }

          Logger.info("Event cleanup", "Plugin cleanup completed");
        } catch (error) {
          // Silently handle errors during cleanup to prevent blocking hot reload
          Logger.debug("Event cleanup", "Cleanup error (non-critical)", error);
        }
      })();

      // Don't await cleanup during hot reload - let it complete in background
      // This prevents blocking the plugin reload process
      cleanupPromise.catch(() => {
        // Ignore errors - cleanup is best effort
      });
    } catch (error) {
      // Top-level error handler - ensure we never throw during close
      Logger.debug(
        "Event cleanup",
        "Close handler error (non-critical)",
        error
      );
    }
  };

  figma.on("close", closeHandler);
}
