// ============================================================================
// GLOBAL SIGNALS STORE - Centralized state management using Preact Signals
// ============================================================================
// This store provides fine-grained reactivity for the plugin UI, replacing
// traditional useState patterns with Signals for better performance and
// automatic dependency tracking.
//
// Authoritative data comes from node.setPluginData() stored on Figma nodes.
// Client storage (figma.clientStorage) serves as a disposable performance cache.
//
// USAGE:
//   import { annotations, currentFrameId } from './store'
//   const allAnnotations = annotations.value
// ============================================================================

import { signal, computed, batch } from '@preact/signals'
import type { Annotation, Screen } from './types'

// ============================================================================
// UI FRAME DATA TYPES - Used for organizing and searching frames
// ============================================================================

export interface PageFrameData {
  id: string
  name: string
  frames: {
    id: string
    name: string
    annotationCount: number
    type: FrameType
  }[]
}

export type FrameType = 'frame' | 'component' | 'instance' | 'group' | 'section'

export interface SearchableFrame {
  id: string
  name: string
  pageName: string
  annotationCount: number
  type: FrameType
  icon: string
  searchText: string // Lowercase text for searching
}

// ============================================================================
// CORE DATA SIGNALS - Authoritative data from Figma nodes
// ============================================================================

// All voice-over annotations loaded from Figma node plugin data
export const annotations = signal<Annotation[]>([])

// Available Figma frames/screens for annotation
export const screens = signal<Screen[]>([])

// Currently selected frame for annotation operations
export const currentFrameId = signal<string | null>(null)

// Current platform (mobile vs web) for annotations
export const currentPlatform = signal<'mobile' | 'web'>('mobile')

// Selection scope for frame discovery (current page vs document-wide)
export const selectionScope = signal<'currentPage' | 'documentWide'>('currentPage')

// ============================================================================
// UI STATE SIGNALS - Ephemeral UI state
// ============================================================================

// Whether user has elements selected in Figma
export const hasSelection = signal<boolean>(false)

// Track insertion state per frame (frameId -> boolean)
export const hasInserted = signal<Record<string, boolean>>({})

// Whether annotations have been modified since last insert
export const hasChangedSinceInsert = signal<boolean>(false)

// Show/hide all annotations toggle
export const showAll = signal<boolean>(true)

// UI theme (light/dark mode)
export const theme = signal<'light' | 'dark'>('light')

// Theme toggle button hover state
export const themeToggleHovered = signal<boolean>(false)

// Track pending annotations (annotation IDs waiting for table creation)
// Used for optimistic UI updates - UI maintains local state until table is created
export const pendingAnnotationIds = signal<Set<number>>(new Set())

// ============================================================================
// STATE RECOVERY SIGNALS - For optimistic update failure recovery (SA-03)
// ============================================================================

// Whether the UI is currently syncing with the authoritative source
// Used to show loading state and disable inputs during recovery
export const isSyncing = signal<boolean>(false)

// ============================================================================
// CIRCUIT BREAKER SIGNALS - For graceful degradation (SA-05)
// ============================================================================

/**
 * Circuit breaker error information for UI display
 */
export interface CircuitBreakerError {
  /** Operation key (e.g., "INSERT_ANNOTATIONS") */
  operation: string
  /** Human-readable reason */
  reason: string
  /** When the cooldown ends (Date.now() + cooldownMs) */
  cooldownEndsAt: number
}

// Map of operation -> error info for currently tripped circuit breakers
// Used to disable affected buttons and show warning banners
export const circuitBreakerErrors = signal<Map<string, CircuitBreakerError>>(new Map())

/**
 * Add a circuit breaker error (when breaker trips)
 */
export function addCircuitBreakerError(operation: string, reason: string, cooldownMs: number) {
  const newMap = new Map(circuitBreakerErrors.value)
  newMap.set(operation, {
    operation,
    reason,
    cooldownEndsAt: Date.now() + cooldownMs,
  })
  circuitBreakerErrors.value = newMap
}

/**
 * Remove a circuit breaker error (when breaker resets)
 */
export function removeCircuitBreakerError(operation: string) {
  const newMap = new Map(circuitBreakerErrors.value)
  newMap.delete(operation)
  circuitBreakerErrors.value = newMap
}

/**
 * Check if an operation is currently blocked by circuit breaker
 */
export function isOperationBlocked(operation: string): boolean {
  const error = circuitBreakerErrors.value.get(operation)
  if (!error) return false
  // Also check if cooldown has expired
  if (Date.now() >= error.cooldownEndsAt) {
    removeCircuitBreakerError(operation)
    return false
  }
  return true
}

/**
 * Get remaining cooldown time for an operation (in ms)
 */
export function getOperationCooldownRemaining(operation: string): number {
  const error = circuitBreakerErrors.value.get(operation)
  if (!error) return 0
  const remaining = error.cooldownEndsAt - Date.now()
  return Math.max(0, remaining)
}

// ============================================================================
// DRAWER STATE SIGNALS - UI Layout
// ============================================================================


// ============================================================================
// LOADING AND ERROR STATE SIGNALS - Async operations
// ============================================================================

// Frame loading indicator
export const isLoadingFrames = signal<boolean>(false)

// Error messages for frame operations
export const framesError = signal<string | null>(null)

// ============================================================================
// COMPUTED SIGNALS - Derived state with automatic recalculation
// ============================================================================
// Note: organizedFrameData and searchableFrames are now computed locally in ui.tsx
// to avoid circular dependencies and keep UI-specific logic in the UI layer

// ============================================================================
// COMPUTED HELPERS - Business logic derived from core signals
// ============================================================================

// Get annotations for the current frame only
export const currentFrameAnnotations = computed(() => {
  if (!currentFrameId.value) return []
  return annotations.value.filter(a => a.frameId === currentFrameId.value)
})

// Get annotations filtered by current platform
export const currentPlatformAnnotations = computed(() => {
  return annotations.value.filter(a => a.platform === currentPlatform.value)
})

// Check if current frame exists and has annotations
export const hasCurrentFrame = computed(() => !!currentFrameId.value)
export const currentFrameHasAnnotations = computed(() => currentFrameAnnotations.value.length > 0)

// Check insertion state for current frame
export const currentFrameHasInserted = computed(() => {
  return currentFrameId.value ? hasInserted.value[currentFrameId.value] || false : false
})

// Check if current frame has changes since last insert
export const currentFrameChangedSinceInsert = computed(() => {
  return currentFrameId.value ?
    hasChangedSinceInsert.value && currentFrameHasAnnotations.value :
    false
})

// ============================================================================
// UTILITY FUNCTIONS - Store manipulation helpers
// ============================================================================

// Reset all signals to initial state (useful for plugin restart)
export function resetStore() {
  annotations.value = []
  screens.value = []
  currentFrameId.value = null
  currentPlatform.value = 'mobile'
  selectionScope.value = 'currentPage'
  hasSelection.value = false
  hasInserted.value = {}
  hasChangedSinceInsert.value = false
  showAll.value = true
  theme.value = 'light'
  themeToggleHovered.value = false;
  isLoadingFrames.value = false
  framesError.value = null
  pendingAnnotationIds.value = new Set()
  isSyncing.value = false
  circuitBreakerErrors.value = new Map()
}

// Update annotations and mark as changed
export function updateAnnotations(newAnnotations: Annotation[]) {
  batch(() => {
    annotations.value = newAnnotations
    hasChangedSinceInsert.value = true
  })
}

// Add a single annotation
export function addAnnotation(annotation: Annotation) {
  // Batching is useful here as we update two signals
  batch(() => {
    annotations.value = [...annotations.value, annotation]
    hasChangedSinceInsert.value = true
  })
}

// Mark an annotation as pending (waiting for table creation)
export function markAnnotationPending(annotationId: number) {
  const newSet = new Set(pendingAnnotationIds.value)
  newSet.add(annotationId)
  pendingAnnotationIds.value = newSet
}

// Remove pending status from an annotation (table has been created)
export function markAnnotationReady(annotationId: number) {
  const newSet = new Set(pendingAnnotationIds.value)
  newSet.delete(annotationId)
  pendingAnnotationIds.value = newSet
}

// Check if an annotation is pending
export function isAnnotationPending(annotationId: number): boolean {
  return pendingAnnotationIds.value.has(annotationId)
}

// Update a specific annotation by composite key (frameId + id)
// CRITICAL: Uses frameId from updates when available to avoid cross-frame collision
export function updateAnnotation(id: number, updates: Partial<Annotation>) {
  const frameId = updates.frameId
  batch(() => {
    annotations.value = annotations.value.map(a => {
      // Use composite key when frameId is available
      if (frameId) {
        return (a.id === id && a.frameId === frameId) ? { ...a, ...updates } : a
      }
      return a.id === id ? { ...a, ...updates } : a
    })
    hasChangedSinceInsert.value = true
  })
}

// Remove an annotation by composite key (frameId + id) - idempotent
// CRITICAL: Must use composite key to avoid cross-frame collision with same annotation IDs
export function removeAnnotation(id: number, frameId?: string) {
  const beforeLength = annotations.value.length
  // If frameId provided, match by composite key; otherwise fall back to id-only for backwards compat
  const newAnnotations = frameId
    ? annotations.value.filter(a => !(a.id === id && a.frameId === frameId))
    : annotations.value.filter(a => a.id !== id)
  const afterLength = newAnnotations.length
  
  // IDEMPOTENCY: Only mark as changed if annotation was actually removed
  if (beforeLength > afterLength) {
    batch(() => {
      annotations.value = newAnnotations
      hasChangedSinceInsert.value = true
    })
  } else {
    // If annotation wasn't found (already removed), still update array but don't mark as changed
    annotations.value = newAnnotations
  }
  // If annotation wasn't found (already removed), this is a no-op - safe to ignore
}

// Mark current frame as inserted
export function markFrameInserted(frameId: string) {
  batch(() => {
    hasInserted.value = {
      ...hasInserted.value,
      [frameId]: true
    }
    hasChangedSinceInsert.value = false
  })
}

// ============================================================================
// PLUGIN SETTINGS SIGNALS - Global plugin configuration
// ============================================================================

export interface PluginSettings {
  // Version and compatibility
  pluginVersion: string
  settingsVersion: number

  // Global sync configuration
  globalSyncEnabled: boolean
  maxConcurrentSyncs: number
  syncBatchSize: number
  syncTimeoutMs: number

  // Performance settings
  enablePerformanceMonitoring: boolean
  performanceLogLevel: 'none' | 'basic' | 'detailed'
  memoryWarningThreshold: number // MB
  cacheCleanupInterval: number // minutes

  // Feature flags
  enableAdvancedValidation: boolean
  enableBulkOperations: boolean
  enableRealTimeSync: boolean
  enableDebugMode: boolean

  // Data management
  autoCleanupEnabled: boolean
  maxStoredAnnotations: number
  dataRetentionDays: number
  compressionEnabled: boolean

  // Error handling
  errorReportingEnabled: boolean
  maxErrorLogs: number

  // Experimental features
  allowExperimentalFeatures: boolean
}

// Default plugin settings
export const defaultPluginSettings: PluginSettings = {
  pluginVersion: '1.0.0',
  settingsVersion: 1,

  globalSyncEnabled: true,
  maxConcurrentSyncs: 3,
  syncBatchSize: 10,
  syncTimeoutMs: 30000,

  enablePerformanceMonitoring: false,
  performanceLogLevel: 'none',
  memoryWarningThreshold: 50,
  cacheCleanupInterval: 30,

  enableAdvancedValidation: false,
  enableBulkOperations: false,
  enableRealTimeSync: false,
  enableDebugMode: false,

  autoCleanupEnabled: true,
  maxStoredAnnotations: 1000,
  dataRetentionDays: 30,
  compressionEnabled: true,

  errorReportingEnabled: false,
  maxErrorLogs: 100,

  allowExperimentalFeatures: false
}

// Plugin settings signal
export const pluginSettings = signal<PluginSettings>(defaultPluginSettings)

// Computed signals for commonly accessed settings
export const syncSettings = computed(() => ({
  globalSyncEnabled: pluginSettings.value.globalSyncEnabled,
  maxConcurrentSyncs: pluginSettings.value.maxConcurrentSyncs,
  batchSize: pluginSettings.value.syncBatchSize,
  timeoutMs: pluginSettings.value.syncTimeoutMs
}))

export const performanceSettings = computed(() => ({
  enableMonitoring: pluginSettings.value.enablePerformanceMonitoring,
  logLevel: pluginSettings.value.performanceLogLevel,
  memoryThreshold: pluginSettings.value.memoryWarningThreshold,
  cleanupInterval: pluginSettings.value.cacheCleanupInterval
}))

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof Pick<PluginSettings,
  'enableAdvancedValidation' | 'enableBulkOperations' | 'enableRealTimeSync' | 'enableDebugMode' | 'allowExperimentalFeatures'
>): boolean => {
  return pluginSettings.value[feature] || false
}

// Settings management functions
export const updatePluginSettings = (updates: Partial<PluginSettings>) => {
  pluginSettings.value = { ...pluginSettings.value, ...updates }
}

export const resetPluginSettings = () => {
  pluginSettings.value = { ...defaultPluginSettings }
}
