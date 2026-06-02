// ============================================================================
// usePluginMessages Hook - Handle plugin message events
// ============================================================================
// Handles all plugin-to-UI message events (INIT, ANNOTATION_CREATED, etc.)
// ============================================================================

import { on, emit } from '@create-figma-plugin/utilities'
import { useSignalEffect } from '@preact/signals'
import type { Signal } from '@preact/signals'
import type {
  InitHandler,
  SelectionChangedHandler,
  FrameAutoSwitchedHandler,
  ExpandAnnotationHandler,
  AnnotationCreatedHandler,
  AnnotationUpdatedHandler,
  AnnotationDeletedHandler,
  AnnotationsReorderedHandler,
  InsertCompleteHandler,
  ScreensListHandler,
  CanvasSyncCompleteHandler,
  GetScreensHandler,
} from "../types";
import type { NodeChangeMessages } from "../types";
import {
  annotations,
  screens,
  currentFrameId,
  selectionScope,
  hasSelection,
  hasChangedSinceInsert,
  hasInserted,
  isLoadingFrames,
  framesError,
  markAnnotationPending,
  markAnnotationReady,
  isSyncing,
} from "../store";
import { Logger } from "../utils/logger";
import { isStaleResponse, completeRequest } from "../utils/request-tracker";

interface UsePluginMessagesParams {
  expandedAnnotationId: Signal<number | null>;
  currentFrameIdRef: { current: string | null };
}

/**
 * Hook to handle plugin message events
 * Processes all plugin-to-UI communication events
 */
export function usePluginMessages({
  expandedAnnotationId,
  currentFrameIdRef,
}: UsePluginMessagesParams): void {
  // Register handlers using useSignalEffect - runs synchronously during render
  // This ensures handlers are registered before any messages arrive
  useSignalEffect(() => {
    const cleanupInit = on<InitHandler>("INIT", function (data) {
      // Receive initial data from main plugin context
      Logger.debug("UI", "Received INIT data from plugin", {
        annotations: data.annotations.length,
        screens: data.screens.length,
        currentFrameId: data.currentFrameId,
        selectionScope: data.selectionScope,
      });

      // Set initial state from plugin
      annotations.value = data.annotations;
      screens.value = data.screens;
      if (data.currentFrameId) {
        currentFrameId.value = data.currentFrameId;
      }
      if (data.selectionScope) {
        selectionScope.value = data.selectionScope;
      }

      // Clear syncing state on INIT (re-sync complete)
      if (isSyncing.value) {
        Logger.info("State recovery", "Re-sync complete - clearing syncing state");
        isSyncing.value = false;
      }
    });

    // PHASE 3: Handle load-source-of-truth message for authoritative data
    const cleanupLoadSourceOfTruth = on(
      "load-source-of-truth" as keyof NodeChangeMessages,
      function (data: NodeChangeMessages["load-source-of-truth"]) {
        Logger.info("UI", "Loading authoritative data from plugin", {
          annotations: data.annotations.length,
          screens: data.screens.length,
        });
        // Authoritative data from plugin always takes precedence
        annotations.value = data.annotations;
        screens.value = data.screens;
      }
    );

    const cleanupSelection = on<SelectionChangedHandler>(
      "SELECTION_CHANGED",
      function (data) {
        hasSelection.value = data.count === 1;
        if (data.frameInfo && data.frameInfo.id) {
          const frameExists = screens.value.some(
            (s) => s.id === data.frameInfo!.id
          );
          if (frameExists) {
            if (currentFrameId.value !== data.frameInfo.id) {
              currentFrameId.value = data.frameInfo.id;
            }
          } else {
            screens.value = [
              ...screens.value,
              { id: data.frameInfo.id, name: data.frameInfo.name },
            ];
            currentFrameId.value = data.frameInfo.id;
          }
        }
      }
    );

    const cleanupFrameSwitch = on<FrameAutoSwitchedHandler>(
      "FRAME_AUTO_SWITCHED",
      function (data) {
        // Ensure screens contains the new frame (copy/paste can introduce new ids)
        const frameExists = screens.value.some((s) => s.id === data.frameId);
        if (!frameExists) {
          screens.value = [...screens.value, { id: data.frameId, name: data.frameName }];
        }

        currentFrameId.value = data.frameId;
        const filtered = annotations.value.filter((a) => a.frameId !== data.frameId);
        annotations.value = [...filtered, ...data.annotations];
      }
    );

    const cleanupExpandAnnotation = on<ExpandAnnotationHandler>(
      "EXPAND_ANNOTATION",
      function (data) {
        Logger.debug("UI", "Expanding annotation accordion", {
          annotationId: data.annotationId,
        });
        expandedAnnotationId.value = data.annotationId;
        // Reset after a short delay to allow the accordion to expand
        setTimeout(() => {
          expandedAnnotationId.value = null;
        }, 100);
      }
    );

    const cleanupAnnotationCreated = on<AnnotationCreatedHandler>(
      "ANNOTATION_CREATED",
      function (data) {
        // Check for stale response
        if (isStaleResponse(data.requestId)) {
          Logger.warn("Plugin messages", "Ignoring stale ANNOTATION_CREATED response", {
            requestId: data.requestId,
            annotationId: data.annotation.id,
          });
          return;
        }

        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId);
        }

        // Skip processing if annotation is invalid (error response)
        if (!data.annotation || !data.annotation.id) {
          Logger.warn("Plugin messages", "Received error response for ANNOTATION_CREATED", {
            requestId: data.requestId,
          });
          return;
        }

        annotations.value = [...annotations.value, data.annotation];
        currentFrameId.value = data.frameId;
        hasChangedSinceInsert.value = true;
        // Mark annotation as pending - UI will maintain optimistic state until table is created
        markAnnotationPending(data.annotation.id);
        // Note: No need to refresh screens when annotation is created
      }
    );

    const cleanupAnnotationUpdated = on<AnnotationUpdatedHandler>(
      "ANNOTATION_UPDATED",
      function (data) {
        // Check for stale response
        if (isStaleResponse(data.requestId)) {
          Logger.warn("Plugin messages", "Ignoring stale ANNOTATION_UPDATED response", {
            requestId: data.requestId,
            annotationId: data.annotation.id,
          });
          return;
        }

        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId);
        }

        // Skip processing if annotation is invalid (error response)
        if (!data.annotation || !data.annotation.id) {
          Logger.warn("Plugin messages", "Received error response for ANNOTATION_UPDATED", {
            requestId: data.requestId,
          });
          return;
        }

        annotations.value = annotations.value.map((a) =>
          (a.id === data.annotation.id && a.frameId === data.annotation.frameId)
            ? { ...a, ...data.annotation }
            : a
        );
        hasChangedSinceInsert.value = true;
      }
    );

    const cleanupAnnotationDeleted = on<AnnotationDeletedHandler>(
      "ANNOTATION_DELETED",
      function (data) {
        // Check for stale response
        if (isStaleResponse(data.requestId)) {
          Logger.warn("Plugin messages", "Ignoring stale ANNOTATION_DELETED response", {
            requestId: data.requestId,
            annotationId: data.id,
          });
          return;
        }

        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId);
        }

        annotations.value = annotations.value.filter(
          (a) => !(a.id === data.id && a.frameId === data.frameId)
        );
        hasChangedSinceInsert.value = true;
        // Remove pending status if annotation was pending
        markAnnotationReady(data.id);
      }
    );

    const cleanupAnnotationsReordered = on<AnnotationsReorderedHandler>(
      "ANNOTATIONS_REORDERED",
      function (data) {
        // Check for stale response
        if (isStaleResponse(data.requestId)) {
          Logger.warn("Plugin messages", "Ignoring stale ANNOTATIONS_REORDERED response", {
            requestId: data.requestId,
          });
          return;
        }

        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId);
        }

        annotations.value = data.annotations;
        hasChangedSinceInsert.value = true;
      }
    );

    const cleanupInsertComplete = on<InsertCompleteHandler>(
      "INSERT_COMPLETE",
      function () {
        const frameId = currentFrameIdRef.current;
        if (frameId) {
          hasInserted.value = { ...hasInserted.value, [frameId]: true };
        }
        hasChangedSinceInsert.value = false;
      }
    );

    // Store loadingTimeout so it can be cleared in SCREENS_LIST handler
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

    const cleanupScreensList = on<ScreensListHandler>(
      "SCREENS_LIST",
      function (data) {
        screens.value = data.screens;
        isLoadingFrames.value = false;
        framesError.value = null;
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
      }
    );

    const cleanupCanvasSyncComplete = on<CanvasSyncCompleteHandler>(
      "CANVAS_SYNC_COMPLETE",
      function (data) {
        annotations.value = data.annotations;
        Logger.info("UI", "Canvas sync complete", {
          count: data.annotations.length,
        });
      }
    );

    const cleanupTableCreated = on(
      "table-created" as keyof NodeChangeMessages,
      function (data: NodeChangeMessages["table-created"]) {
        Logger.debug("UI", "Table created - removing pending status", {
          annotationId: data.annotationId,
        });
        // Remove pending status - UI will now sync with plugin state
        markAnnotationReady(data.annotationId);
      }
    );

    // SA-03: Handle save-data-result failures with state recovery
    const cleanupSaveDataResult = on(
      "save-data-result" as keyof NodeChangeMessages,
      function (data: NodeChangeMessages["save-data-result"]) {
        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId);
        }

        if (!data.success) {
          Logger.warn("State recovery", "Operation failed, triggering re-sync", {
            error: data.error,
            requestId: data.requestId,
          });

          // Show notification to user
          // Note: figma.notify is not available in UI context, but we can log
          Logger.info("State recovery", "Operation failed, syncing...");

          // Set syncing state
          isSyncing.value = true;

          // Request re-sync with authoritative source
          emit("request-resync" as keyof NodeChangeMessages, {});

          // Auto-dismiss syncing state after timeout (max 5s)
          setTimeout(() => {
            if (isSyncing.value) {
              Logger.warn("State recovery", "Re-sync timeout - clearing syncing state");
              isSyncing.value = false;
            }
          }, 5000);
        }
      }
    );

    // Delay GET_SCREENS emission to ensure all handlers are registered first
    // This prevents "No event handler" errors if component crashes during render
    setTimeout(() => {
      isLoadingFrames.value = true;
      framesError.value = null;
      emit<GetScreensHandler>("GET_SCREENS");

      // Set timeout for loading
      loadingTimeout = setTimeout(() => {
        if (isLoadingFrames.value) {
          isLoadingFrames.value = false;
          framesError.value = "Loading timed out. Please try again.";
        }
      }, 10000); // 10 second timeout
    }, 0);

    return () => {
      cleanupInit();
      cleanupSelection();
      cleanupFrameSwitch();
      cleanupExpandAnnotation();
      cleanupAnnotationCreated();
      cleanupAnnotationUpdated();
      cleanupAnnotationDeleted();
      cleanupAnnotationsReordered();
      cleanupInsertComplete();
      cleanupScreensList();
      cleanupCanvasSyncComplete();
      cleanupLoadSourceOfTruth();
      cleanupTableCreated();
      cleanupSaveDataResult();
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  });
}

