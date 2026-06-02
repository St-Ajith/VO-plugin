// ============================================================================
// useNodeChangeSync Hook - Handle node change synchronization
// ============================================================================
// Handles bidirectional sync for node changes (Plugin → UI)
// Includes timestamp-based conflict resolution
// ============================================================================

import { on, emit } from '@create-figma-plugin/utilities'
import { useSignalEffect } from '@preact/signals'
import type { NodeChangeMessages } from '../types'
import type { GetScreensHandler } from '../types'
import {
  annotations,
  screens,
  currentFrameId,
  selectionScope,
  isLoadingFrames,
  framesError,
  hasChangedSinceInsert,
  addAnnotation,
  removeAnnotation
} from '../store'
import { Logger } from '../utils/logger'
import { isStaleResponse, completeRequest } from '../utils/request-tracker'

/**
 * Hook to handle node change synchronization
 * Syncs UI state when nodes change on canvas
 * Handles timestamp-based conflict resolution
 */
export function useNodeChangeSync(): void {
  useSignalEffect(() => {
    // Handle plugin notifications about node changes (Plugin → UI)
    const cleanupNodesCreated = on('nodes-created' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['nodes-created']) {
        Logger.debug('Sync direction', 'Nodes created', { count: data.nodes.length })
        for (const node of data.nodes) {
          addAnnotation(node.annotation)
        }
      }
    )

    const cleanupNodesUpdated = on('nodes-updated' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['nodes-updated']) {
        Logger.debug('Sync direction', 'Nodes updated', { count: data.nodes.length })
        let hasUpdates = false
        for (const node of data.nodes) {
          // TIMESTAMP CONFLICT RESOLUTION: Compare timestamps to resolve conflicts
          // Match by composite key (frameId + id) since IDs are frame-scoped
          const existingIndex = annotations.value.findIndex(
            a => a.id === node.annotation.id && a.frameId === node.annotation.frameId
          )
          if (existingIndex !== -1) {
            const currentAnnotation = annotations.value[existingIndex]
            if (!currentAnnotation) return
            const incomingTimestamp = node.annotation.updatedAt || node.annotation.createdAt || 0
            const currentTimestamp = currentAnnotation.updatedAt || currentAnnotation.createdAt || 0

            // Only update if incoming timestamp is newer
            if (incomingTimestamp > currentTimestamp) {
              // Incoming timestamp is newer - update
              // Create new array to trigger Preact Signals reactivity
              const updatedAnnotations = [...annotations.value]
              updatedAnnotations[existingIndex] = node.annotation
              annotations.value = updatedAnnotations
              hasUpdates = true
              Logger.debug('Sync direction', 'Updated annotation from plugin (newer timestamp)', {
                annotationId: node.annotation.id,
                frameId: node.annotation.frameId,
                incomingTimestamp,
                currentTimestamp
              })
            } else {
              // Current timestamp is newer or equal - keep current
              Logger.debug('Sync direction', 'Skipping update (current timestamp is newer or equal)', {
                annotationId: node.annotation.id,
                frameId: node.annotation.frameId,
                incomingTimestamp,
                currentTimestamp
              })
            }
          } else {
            // If annotation doesn't exist, add it
            addAnnotation(node.annotation)
            hasUpdates = true
            Logger.debug('Sync direction', 'Added new annotation from plugin', {
              annotationId: node.annotation.id,
              frameId: node.annotation.frameId
            })
          }
        }
        
        // Mark as changed if any updates were applied (from canvas)
        // This ensures the UI reflects that annotations have been modified
        if (hasUpdates) {
          hasChangedSinceInsert.value = true
        }
      }
    )

    const cleanupNodesDeleted = on('nodes-deleted' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['nodes-deleted']) {
        Logger.debug('Sync direction', 'Nodes deleted', { count: data.nodeIds.length })
        const deletedFrameIds = new Set<string>()
        
        for (const nodeId of data.nodeIds) {
          // Find annotation by elementId and remove it (idempotent)
          const annotation = annotations.value.find(a => a.elementId === nodeId)
          if (annotation) {
            removeAnnotation(annotation.id)
            Logger.debug('Sync direction', 'Removed annotation from UI', {
              annotationId: annotation.id,
              nodeId
            })
          } else {
            // IDEMPOTENCY: Annotation already removed - log but don't error
            Logger.debug('Sync direction', 'Annotation already removed (idempotent)', {
              nodeId
            })
          }

          // Check if this deleted node is a frame in our screens list
          const deletedFrame = screens.value.find(screen => screen.id === nodeId)
          if (deletedFrame) {
            deletedFrameIds.add(nodeId)
            Logger.debug('Sync direction', 'Frame deleted from screens', { frameId: nodeId, frameName: deletedFrame.name })
          }
        }

        // Remove deleted frames from screens list immediately for instant UI update
        if (deletedFrameIds.size > 0) {
          screens.value = screens.value.filter(screen => !deletedFrameIds.has(screen.id))
          Logger.info('Sync direction', 'Removed deleted frames from screens', { count: deletedFrameIds.size })

          // Clear currentFrameId if it was pointing to a deleted frame
          if (currentFrameId.value && deletedFrameIds.has(currentFrameId.value)) {
            currentFrameId.value = null
            Logger.debug('Sync direction', 'Cleared currentFrameId as frame was deleted')
          }
        }

        // Force refresh of screens to ensure consistency with Figma state
        // Document mode needs delay to allow Figma's async state updates to complete
        const refreshScreens = async () => {
          isLoadingFrames.value = true
          framesError.value = null

          // Small delay for document mode to ensure Figma state is consistent
          if (selectionScope.value === 'documentWide') {
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          emit<GetScreensHandler>('GET_SCREENS')
        }

        // Use async function to handle the refresh properly
        refreshScreens().catch(error => {
          Logger.error('UI', 'Failed to refresh screens after frame deletion', error)
          isLoadingFrames.value = false
          framesError.value = 'Failed to refresh frames'
        })
      }
    )

    const cleanupSaveDataResult = on('save-data-result' as keyof NodeChangeMessages,
      function (data: NodeChangeMessages['save-data-result']) {
        // Check for stale response
        if (isStaleResponse(data.requestId)) {
          Logger.warn('Sync direction', 'Ignoring stale save-data-result response', {
            requestId: data.requestId,
            success: data.success,
          })
          return
        }

        // Complete request tracking
        if (data.requestId) {
          completeRequest(data.requestId)
        }

        if (data.success) {
          Logger.debug('Sync direction', 'Save operation successful', {
            requestId: data.requestId,
          })
        } else {
          Logger.error('Sync direction', 'Save operation failed', {
            error: data.error,
            requestId: data.requestId,
          })
          // Could show user notification here if needed
        }
      }
    )

    return () => {
      cleanupNodesCreated()
      cleanupNodesUpdated()
      cleanupNodesDeleted()
      cleanupSaveDataResult()
    }
  })
}

