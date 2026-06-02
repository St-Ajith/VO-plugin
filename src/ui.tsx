import {
  render,
  useWindowResize
} from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { useRef } from 'preact/hooks'
import { useSignal, useComputed, useSignalEffect } from '@preact/signals'
import { Show } from '@preact/signals/utils'
import { usePluginMessages } from './hooks/usePluginMessages'
import { useNodeChangeSync } from './hooks/useNodeChangeSync'
import { useAnnotationOperations } from './hooks/useAnnotationOperations'
import { Logger, ErrorBoundary } from './ui/utils'
import { trackRequest, startCleanupInterval } from './utils/request-tracker'
import { generateRequestId } from './utils/generate-request-id'
import { getStyles } from './ui/theme'
import { FrameSelector } from './ui/components/FrameSelector'
import { PlatformTabs } from './ui/components/PlatformTabs'
import { AnnotationList } from './ui/components/AnnotationList'
import { organizeFramesByPages } from './ui/frame-utils'

import {
  Annotation,
  CreateAnnotationHandler,
  GenerateFrameHandler,
  GetScreensHandler,
  InsertAnnotationsHandler,
  PluginActionMessages,
  ReorderAnnotationHandler,
  SyncCanvasHandler,
  ToggleAnnotationsHandler,
  UpdateAnnotationsHandler,
  UpdateUserSettingsHandler
} from './types'
import {
  annotations,
  screens,
  currentFrameId,
  currentPlatform,
  selectionScope,
  hasSelection,
  hasInserted,
  hasChangedSinceInsert,
  showAll,
  theme,
  themeToggleHovered,
  isLoadingFrames,
  framesError,
  currentFrameAnnotations,
  hasCurrentFrame,
  currentFrameHasAnnotations,
  currentFrameHasInserted,
  currentFrameChangedSinceInsert,
  updateAnnotation,
  removeAnnotation,
  markAnnotationReady,
  isSyncing
} from './store.js'



// ============================================================================
// COMPONENTS
// ============================================================================

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function Plugin() {
  // ============================================================================
  // REACTIVE STATE ARCHITECTURE - Preact Signals
  // ============================================================================
  //
  // This plugin uses Preact Signals for reactive state management, providing:
  // - Automatic dependency tracking (no manual useEffect deps needed)
  // - Fine-grained reactivity (only affected components re-render)
  // - Computed values that automatically update when dependencies change
  // - Effects that run automatically when accessed signals change
  //
  // Signals are the source of truth - components subscribe to them automatically.
  // When a signal's .value changes, all components using that signal re-render.
  // ============================================================================

  // ============================================================================
  // SIGNALS - Now imported from global store for centralized state management
  // ============================================================================
  const currentFrameIdRef = useRef<string | null>(null)

  const styles = getStyles(theme.value)

  // Track which annotation accordion should be expanded (from annotation table selection)
  const expandedAnnotationId = useSignal<number | null>(null)

  // ============================================================================
  // ENHANCED WINDOW RESIZE HANDLING - Better resize behavior with constraints
  // ============================================================================
  // From figma-api-recipes.md: Enhanced useWindowResize with proper constraints and behavior

  useWindowResize((windowSize) => {
    // Handle window resize with constraints
    Logger.debug('UI', 'Window resize detected', windowSize)
    // Note: Window size persistence would need to be handled via RESIZE_WINDOW event to main context
    // clientStorage is not available in UI context
  }, {
    minWidth: 320,
    minHeight: 400,
    maxWidth: 800,
    maxHeight: 1000,
    resizeBehaviorOnDoubleClick: 'minimize'
  })

  // Keep ref in sync with state
  useSignalEffect(() => {
    currentFrameIdRef.current = currentFrameId.value
  })

  // ============================================================================
  // DEBOUNCED SCREEN REFRESH - Prevent excessive GET_SCREENS calls
  // ============================================================================

  let screenRefreshTimeout: number | null = null

  // ============================================================================
  // PLUGIN MESSAGE HANDLERS - Split into focused custom hooks
  // ============================================================================
  // Replaced large useSignalEffect with focused hooks for better maintainability
  // ============================================================================

  // Handle plugin message events (INIT, ANNOTATION_CREATED, etc.)
  usePluginMessages({
    expandedAnnotationId,
    currentFrameIdRef
  })

  // Handle node change synchronization (nodes-created, nodes-updated, nodes-deleted)
  useNodeChangeSync()

  // Handle real-time field updates (field-update-realtime)
  useAnnotationOperations()

  // ============================================================================
  // COMPUTED VALUES - Automatic derived state
  // ============================================================================
  //
  // useComputed() creates signals that automatically recalculate when dependencies change.
  // Unlike useMemo, computed signals track dependencies automatically - no manual arrays!
  // They only update when their accessed signals actually change, providing optimal performance.
  // ============================================================================

  // FRAME DATA ORGANIZATION - Hierarchical view of Figma frames by page
  // Automatically updates when screens or annotations change
  const organizedFrameDataComputed = useComputed(() => {
    // PERFORMANCE OPTIMIZATION: Only compute if we have data
    if (screens.value.length === 0) return []
    return organizeFramesByPages(screens.value, annotations.value)
  })


  // ============================================================================
  // PERFORMANCE OPTIMIZATION: Memory management and cleanup
  // ============================================================================

  // Clean up resources on unmount
  // Initialize request tracker cleanup interval on mount
  useSignalEffect(() => {
    startCleanupInterval()
    return () => {
      // Cleanup handled by stopCleanupInterval if needed
    }
  })

  // useSignalEffect runs once on mount when no signals are accessed
  useSignalEffect(() => {
    return () => {
      // Clear any pending screen refresh timeouts
      if (screenRefreshTimeout) {
        clearTimeout(screenRefreshTimeout)
        screenRefreshTimeout = null
      }

      // Settings are managed by main plugin context - no UI cleanup needed

      Logger.debug('UI', 'Component unmounting, cleaning up resources')
    }
  })

  // ============================================================================
  // UI COMPUTED VALUES - Reactive UI state derived from user interactions
  // ============================================================================

  // PLATFORM-FILTERED ANNOTATIONS - Current platform's annotations only
  // Optimized: filter annotations directly with both frameId and platform conditions
  // Automatically updates when currentFrameId, annotations, or currentPlatform change
  const platformAnnotations = useComputed(() => {
    if (!currentFrameId.value) return []
    return annotations.value.filter(
      (a) => a.frameId === currentFrameId.value && a.platform === currentPlatform.value
    )
  })

  // PLATFORM ANNOTATION COUNTS - For PlatformTabs badges
  // Optimized: compute both counts in single pass
  const platformCounts = useComputed(() => {
    const frameAnns = currentFrameAnnotations.value
    let mobile = 0
    let web = 0
    for (const ann of frameAnns) {
      if (ann.platform === 'mobile') mobile++
      else if (ann.platform === 'web') web++
    }
    return { mobile, web }
  })
  const mobileAnnotationCount = useComputed(() => platformCounts.value.mobile)
  const webAnnotationCount = useComputed(() => platformCounts.value.web)

  // CURRENT FRAME DISPLAY NAME - For header display
  // Automatically updates when currentFrameId or screens change
  const currentFrameDisplayName = useComputed(() => {
    if (!currentFrameId.value || screens.value.length === 0) return ''
    return screens.value.find((s) => s.id === currentFrameId.value)?.name || ''
  })

  // INSERT BUTTON STATE - Uses computed signals from store.ts
  // hasCurrentFrame, currentFrameHasAnnotations, currentFrameHasInserted, 
  // currentFrameChangedSinceInsert are imported from store.ts


  const handleGetScreens = () => {
    emit<GetScreensHandler>('GET_SCREENS')
  }

  // Platform switching now handled by PlatformTabs component

  const handleCreateAnnotation = () => {
    // SA-03: Suppress actions during re-sync to prevent echo loop
    if (isSyncing.value) {
      Logger.debug('UI', 'Create blocked - sync in progress')
      return
    }
    
    // The plugin will handle creation and notify UI via nodechange events
    Logger.info('UI', 'Create annotation requested - plugin will handle via selection')
    
    // Generate requestId and track request
    const requestId = generateRequestId()
    trackRequest({
      requestId,
      operationType: 'CREATE',
      timestamp: Date.now(),
      preMutationSnapshot: [...annotations.value], // Capture current state
    })
    
    emit<CreateAnnotationHandler>('CREATE_ANNOTATION', { requestId })
  }

  const handleGenerateFrame = () => {
    if (isSyncing.value || !currentFrameId.value) {
      Logger.debug('UI', 'Generate blocked - no frame or sync in progress')
      return
    }
    Logger.info('UI', 'Generate-for-frame requested', { frameId: currentFrameId.value })
    emit<GenerateFrameHandler>('GENERATE_FRAME', {
      frameId: currentFrameId.value,
      requestId: generateRequestId(),
    })
  }

  const handleUpdateAnnotation = (id: number, data: Partial<Annotation>) => {
    // SA-03: Suppress actions during re-sync to prevent echo loop
    if (isSyncing.value) {
      Logger.debug('UI', 'Update blocked - sync in progress', { annotationId: id })
      return
    }
    
    // CRITICAL: Find by BOTH id AND current frameId to avoid cross-frame collision
    const frameId = currentFrameId.value
    const annotation = annotations.value.find(a => a.id === id && a.frameId === frameId)
    if (annotation) {
      // Generate requestId and track request before optimistic update
      const requestId = generateRequestId()
      trackRequest({
        requestId,
        operationType: 'UPDATE',
        timestamp: Date.now(),
        preMutationSnapshot: [...annotations.value], // Capture current state
      })
      
      // Update UI
      const updatedAnnotation = { ...annotation, ...data }
      updateAnnotation(id, updatedAnnotation)
      
      // Send update to plugin immediately (includes frameId for composite key matching)
      Logger.debug('UI', 'Sending update to plugin', { annotationId: id, frameId, requestId })
      emit('save-data' as keyof PluginActionMessages, {
        annotation: updatedAnnotation,
        requestId
      } as PluginActionMessages['save-data'])
    }
  }

  const handleDeleteAnnotation = (id: number) => {
    // SA-03: Suppress actions during re-sync to prevent echo loop
    if (isSyncing.value) {
      Logger.debug('UI', 'Delete blocked - sync in progress', { annotationId: id })
      return
    }
    
    // CRITICAL: Find by BOTH id AND current frameId to avoid cross-frame collision
    const frameId = currentFrameId.value
    const annotation = annotations.value.find(a => a.id === id && a.frameId === frameId)
    if (annotation && frameId) {
      // Generate requestId and track request before optimistic update
      const requestId = generateRequestId()
      trackRequest({
        requestId,
        operationType: 'DELETE',
        timestamp: Date.now(),
        preMutationSnapshot: [...annotations.value], // Capture current state
      })
      
      // Remove from UI - use composite key
      removeAnnotation(id, frameId)
      // Clear pending status if annotation was pending
      markAnnotationReady(id)
      
      // Send delete to plugin with frameId for composite key lookup
      Logger.debug('UI', 'Sending delete to plugin', { annotationId: id, frameId, requestId })
      emit('delete-data' as keyof PluginActionMessages, {
        annotationId: id,
        frameId: frameId,
        elementId: annotation.elementId,
        requestId
      } as PluginActionMessages['delete-data'])
    }
  }

  const handleReorderAnnotation = (id: number, direction: 'up' | 'down') => {
    // SA-03: Suppress actions during re-sync to prevent echo loop
    if (isSyncing.value) {
      Logger.debug('UI', 'Reorder blocked - sync in progress', { annotationId: id })
      return
    }
    
    // Generate requestId and track request before optimistic update
    const requestId = generateRequestId()
    trackRequest({
      requestId,
      operationType: 'REORDER',
      timestamp: Date.now(),
      preMutationSnapshot: [...annotations.value], // Capture current state
    })
    
    emit<ReorderAnnotationHandler>('REORDER_ANNOTATION', id, direction, requestId)
  }

  const handleInsert = () => {
    // SA-03: Suppress actions during re-sync to prevent echo loop
    if (isSyncing.value) {
      Logger.debug('UI', 'Insert blocked - sync in progress')
      return
    }
    
    const frameName =
      screens.value.find((s) => s.id === currentFrameId.value)?.name || 'this screen'
    const frameHasInserted = hasInserted.value[currentFrameId.value || ''] || false
    const action = frameHasInserted ? 'update' : 'insert'
    const count = currentFrameAnnotations.value.length

    let message = ''
    if (action === 'insert') {
      message = `Insert ${count} annotation${count > 1 ? 's' : ''} for ${frameName}?\n\nYou can add more annotations or update these later.`
    } else {
      message = `Update ${count} annotation${count > 1 ? 's' : ''} for ${frameName}?\n\nThis will refresh all visual elements on the canvas.`
    }

    if (confirm(message)) {
      if (action === 'insert') {
        emit<InsertAnnotationsHandler>('INSERT_ANNOTATIONS')
      } else {
        emit<UpdateAnnotationsHandler>('UPDATE_ANNOTATIONS')
      }
    }
  }

  const handleToggle = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement
    const visible = target.checked
    showAll.value = visible
    emit<ToggleAnnotationsHandler>('TOGGLE_ANNOTATIONS', visible)
  }

  const insertButtonText = useComputed(() =>
    !hasCurrentFrame.value || !currentFrameHasAnnotations.value
      ? 'Insert into Figma'
      : currentFrameChangedSinceInsert.value
        ? 'Update Annotations'
        : currentFrameHasInserted.value
          ? 'Update Annotations'
          : 'Insert into Figma'
  )

  const insertButtonDisabled = useComputed(() =>
    !hasCurrentFrame.value || !currentFrameHasAnnotations.value ||
    (currentFrameHasInserted.value && !hasChangedSinceInsert.value) ||
    isSyncing.value
  )

  const handleThemeToggle = () => {
    const newTheme = theme.value === 'light' ? 'dark' : 'light'
    theme.value = newTheme

    // Send theme update to main plugin context
    emit<UpdateUserSettingsHandler>('UPDATE_USER_SETTINGS', {
      settings: { theme: newTheme }
    })
  }


  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: styles.content.backgroundColor,
        position: 'relative'
      }}
    >
      {/* SA-03: Syncing overlay - shown during state recovery */}
      <Show when={isSyncing}>
        {() => (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 500
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                border: '3px solid rgba(255, 255, 255, 0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '12px'
              }}
            />
            <div>Operation failed, syncing...</div>
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </Show>
      <header style={styles.header}>
        <h2 style={styles.headerTitle}>
          Voice over annotations
          <Show when={currentFrameDisplayName}>
            {(name) => <span> - {name}</span>}
          </Show>
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            style={{
              ...styles.themeToggle,
              ...(themeToggleHovered.value ? styles.themeToggleHover : {})
            }}
            onClick={handleThemeToggle}
            onMouseEnter={() => themeToggleHovered.value = true}
            onMouseLeave={() => themeToggleHovered.value = false}
            title={`Switch to ${theme.value === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme.value === 'light' ? '🌙' : '☀️'} {theme.value === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
      </header>

      <main style={styles.content}>
        <FrameSelector
          currentFrameId={currentFrameId}
          organizedFrameData={organizedFrameDataComputed}
          selectionScope={selectionScope}
          isLoadingFrames={isLoadingFrames}
          framesError={framesError}
          theme={theme}
          onGetScreens={handleGetScreens}
        />

        <PlatformTabs
          currentPlatform={currentPlatform}
          mobileAnnotationCount={mobileAnnotationCount}
          webAnnotationCount={webAnnotationCount}
          theme={theme}
        />

        <div style={{ marginBottom: '24px' }}>
          <button
            style={{
              ...styles.addAnnotationButton,
              ...((!hasSelection || !currentFrameId || isSyncing.value) ? styles.addAnnotationButtonDisabled : {})
            }}
            onClick={handleCreateAnnotation}
            disabled={!hasSelection || !currentFrameId || isSyncing.value}
            onMouseEnter={(e) => {
              if (!(!hasSelection || !currentFrameId || isSyncing.value)) {
                e.currentTarget.style.backgroundColor = styles.addAnnotationButtonHover.backgroundColor
              }
            }}
            onMouseLeave={(e) => {
              if (!(!hasSelection || !currentFrameId || isSyncing.value)) {
                e.currentTarget.style.backgroundColor = styles.addAnnotationButton.backgroundColor
              }
            }}
          >
            Add Annotation
          </button>

          <button
            style={{
              ...styles.addAnnotationButton,
              backgroundColor: 'transparent',
              color: styles.addAnnotationButton.backgroundColor,
              border: `1px solid ${styles.addAnnotationButton.backgroundColor}`,
              marginTop: '8px',
              ...((!currentFrameId || isSyncing.value) ? styles.addAnnotationButtonDisabled : {})
            }}
            onClick={handleGenerateFrame}
            disabled={!currentFrameId || isSyncing.value}
            title="Scan the selected frame and generate one annotation per focusable element, in reading order"
          >
            ✨ Generate for frame
          </button>
        </div>

        <AnnotationList
          currentFrameId={currentFrameId}
          frameAnnotations={currentFrameAnnotations}
          platformAnnotations={platformAnnotations}
          currentPlatform={currentPlatform}
          screens={screens}
          theme={theme}
          expandedAnnotationId={expandedAnnotationId}
          onUpdate={handleUpdateAnnotation}
          onDelete={handleDeleteAnnotation}
          onReorder={handleReorderAnnotation}
        />
      </main>

      <footer style={styles.footer}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            style={{
              ...styles.footerButton,
              ...(insertButtonDisabled.value ? styles.footerButtonDisabled : {}),
              fontSize: '13px',
              padding: '6px 16px'
            }}
            onClick={handleInsert}
            disabled={insertButtonDisabled}
            onMouseEnter={(e) => {
              if (!insertButtonDisabled.peek()) {
                e.currentTarget.style.backgroundColor = styles.footerButtonHover.backgroundColor
              }
            }}
            onMouseLeave={(e) => {
              if (!insertButtonDisabled.peek()) {
                e.currentTarget.style.backgroundColor = styles.footerButton.backgroundColor
              }
            }}
          >
            {insertButtonText}
          </button>
          <button
            style={{
              ...styles.footerButton,
              fontSize: '13px',
              padding: '6px 16px',
              backgroundColor: '#10B981', // Green color for sync
            }}
            onClick={() => emit<SyncCanvasHandler>('SYNC_CANVAS')}
            title="Sync changes made directly in Figma canvas back to the plugin"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10B981'
            }}
          >
            🔄 Sync Canvas
          </button>
        </div>
        <div style={styles.toggleSwitch}>
          <span
            style={{
              ...styles.toggleLabel,
              ...(!showAll.value ? styles.toggleLabelActive : {})
            }}
          >
            Hide all
          </span>
          <label
            style={{
              ...styles.toggleTrack,
              ...(showAll.value ? styles.toggleTrackActive : {})
            }}
          >
            <input
              type="checkbox"
              checked={showAll.value}
              onChange={handleToggle}
              style={{ display: 'none' }}
            />
            <span
              style={{
                ...styles.toggleKnob,
                ...(showAll.value ? styles.toggleKnobActive : {})
              }}
            />
          </label>
          <span
            style={{
              ...styles.toggleLabel,
              ...(showAll.value ? styles.toggleLabelActive : {})
            }}
          >
            Show all
          </span>
        </div>
      </footer>

    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Plugin />
    </ErrorBoundary>
  )
}

export default render(App)
