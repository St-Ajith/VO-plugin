// ============================================================================
// useAnnotationOperations Hook - Handle real-time field updates
// ============================================================================
// Handles real-time field updates from canvas (immediate sync, bypass debounce)
// ============================================================================

import { on } from '@create-figma-plugin/utilities'
import { useSignalEffect } from '@preact/signals'
import type { NodeChangeMessages } from '../types'
import type { Annotation } from '../types'
import { annotations, updateAnnotation } from '../store'
import { Logger } from '../utils/logger'

/**
 * Hook to handle real-time annotation field updates
 * Processes canvas→UI updates immediately (bypasses debounce)
 * Prevents feedback loops by only processing canvas-sourced updates
 */
export function useAnnotationOperations(): void {
  useSignalEffect(() => {
    // Handle real-time field updates from canvas (Canvas → UI, immediate sync)
    const cleanupRealtimeFieldUpdate = on('field-update-realtime' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['field-update-realtime']) {
        // Only process if source is canvas (prevent feedback loops)
        if (data.source !== "canvas") {
          return;
        }

        Logger.debug("Real-time sync", "Received canvas→UI field update", {
          annotationId: data.annotationId,
          frameId: data.frameId,
          field: data.field,
        });

        // CRITICAL: Find annotation by composite key (frameId + id) to avoid cross-frame collision
        const annotation = annotations.value.find(
          (a) => a.id === data.annotationId && a.frameId === data.frameId
        );
        if (!annotation) {
          Logger.warn(
            "Real-time sync",
            "Annotation not found for field update",
            {
              annotationId: data.annotationId,
              frameId: data.frameId,
            }
          );
          return;
        }

        // Update the specific field in the annotation
        const parts = data.field.split(".");
        const updateData: Partial<Annotation> = { id: annotation.id };

        if (parts[0] === "mobile" && parts.length >= 3) {
          const platformKey = parts[1] as string;
          const fieldKey = parts[2] as string;
          updateData.mobile = {
            ...annotation.mobile!,
            [platformKey]: {
              ...annotation.mobile![platformKey as "ios" | "android"],
              [fieldKey]: data.value,
            },
          };
        } else if (parts[0] === "web" && parts.length >= 2) {
          const fieldKey = parts[1] as string;
          updateData.web = {
            ...annotation.web!,
            [fieldKey]: data.value,
          };
        }

        // Update annotation immediately (bypass debounce for real-time sync)
        // This updates the annotations signal, which triggers:
        // 1. platformAnnotations computed signal recalculates
        // 2. AnnotationList re-renders (uses platformAnnotations.value)
        // 3. AccordionItem components receive new annotation objects
        // 4. AccordionItem memo comparison detects updatedAt change and re-renders
        updateAnnotation(data.annotationId, { ...annotation, ...updateData });

        Logger.debug("Real-time sync", "Updated UI field from canvas", {
          annotationId: data.annotationId,
          field: data.field,
        });
      }
    )

    // Handle real-time field update results from plugin (Plugin → UI, confirmation/error)
    const cleanupRealtimeFieldUpdateResult = on('field-update-realtime-result' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['field-update-realtime-result']) {
        if (data.success) {
          Logger.debug('Real-time sync', 'Field update confirmed', {
            annotationId: data.annotationId,
            field: data.field
          })
        } else {
          // Expected failures: table not found (annotation just created) or table still being created
          // These are normal during annotation creation/table recreation, not actual errors
          const isExpectedFailure = data.error === 'Table not found' || data.error === 'Table still being created'
          if (isExpectedFailure) {
            Logger.debug('Real-time sync', 'Field update skipped (expected)', {
              annotationId: data.annotationId,
              field: data.field,
              reason: data.error
            })
          } else {
            Logger.warn('Real-time sync', 'Field update failed', {
              annotationId: data.annotationId,
              field: data.field,
              error: data.error
            })
          }
          // Note: We don't revert the UI change here because:
          // 1. The debounced save-data will eventually sync the correct state
          // 2. The user can see the error and manually correct if needed
          // 3. Reverting might cause flicker/confusion
        }
      }
    )

    return () => {
      cleanupRealtimeFieldUpdate()
      cleanupRealtimeFieldUpdateResult()
    }
  })
}

