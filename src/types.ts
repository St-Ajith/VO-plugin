import { EventHandler } from "@create-figma-plugin/utilities";

// ============================================================================
// DATA TYPES
// ============================================================================

export interface Screen {
  id: string;
  name: string;
}

// Container metadata structure stored in plugin data
export interface ContainerMetadata {
  sourceFrameId: string;
  version: number;
  timestamp: number;
}

// Badge metadata structure stored in plugin data
export interface BadgeMetadata {
  sourceFrameId: string;
  annotationId: number;
  version: number;
  timestamp: number;
  elementId?: string;
}

export interface Annotation {
  id: number;
  frameId: string;
  frameName: string;
  pageId: string;
  pageName: string;
  platform: "mobile" | "web";
  elementId: string;
  elementName: string;
  voicedPreview: string;
  // Element Targeting - ID of the specific element this annotation targets (for sub-frame targeting)
  targetElementId: string | null;
  // Metadata for change tracking
  createdAt: number;
  updatedAt: number;
  mobile?: {
    ios: { label: string; value: string; trait: string; hint: string };
    android: { label: string; value: string; trait: string; hint: string };
  };
  web?: {
    ariaLabel: string;
    role: string;
    ariaDescribedBy: string;
    tabIndex: string;
  };
}

// ============================================================================
// DATA STORAGE INTERFACES - Schema consistency across plugin data sources
// ============================================================================

// Plugin data stored directly on Figma nodes (AUTHORITATIVE SOURCE)
export interface NodePluginData {
  annotation: Annotation;
  timestamp: number; // When this data was stored on the node
}

// Client storage cache schema (PERFORMANCE CACHE - disposable)
export interface ClientStorageData {
  annotations: Annotation[];
  timestamp: number; // When this cache was last updated
  version: string; // Cache format version for migration
}

// Legacy shared plugin data schema (for migration purposes only)
export interface LegacySharedData {
  annotations: Annotation[];
}

// ============================================================================
// SYNC MESSAGE INTERFACES - Communication between main.ts and ui.tsx
// ============================================================================

// Messages from main.ts to ui.tsx (Plugin → UI updates)
export interface NodeChangeMessages {
  // Real-time node changes detected by figma.currentPage.on('nodechange')
  "nodes-created": { nodes: Array<{ id: string; annotation: Annotation }> };
  "nodes-updated": { nodes: Array<{ id: string; annotation: Annotation }> };
  "nodes-deleted": { nodeIds: string[] };

  // Initial data loading
  "load-source-of-truth": { annotations: Annotation[]; screens: Screen[] };

  // Async operation results
  "save-data-result": { success: boolean; error?: string; requestId?: string };

  // Real-time field updates (Canvas → UI, immediate sync)
  "field-update-realtime": {
    annotationId: number;
    frameId: string;
    field: string;
    value: string;
    source: "ui" | "canvas";
  };

  // Real-time field update results
  "field-update-realtime-result": {
    annotationId: number;
    field: string;
    success: boolean;
    error?: string;
  };

  // Table creation confirmation (for pending annotation state management)
  "table-created": {
    annotationId: number;
  };
}

// Messages from ui.tsx to main.ts (UI → Plugin actions)
export interface PluginActionMessages {
  // Data operations that need to save to authoritative source
  "save-data": { annotation: Annotation; requestId?: string };
  "delete-data": { annotationId: number; frameId: string; elementId: string; requestId?: string };

  // UI state synchronization
  "update-annotations": { annotations: Annotation[] };

  // Real-time field updates (bypass debounce for immediate sync)
  "field-update-realtime": {
    annotationId: number;
    frameId: string;
    field: string;
    value: string;
    source: "ui" | "canvas";
  };

  // Request re-sync with authoritative source (SA-03 state recovery)
  "request-resync": Record<string, never>;

  // Auto-generate annotations for every focusable element in a frame
  "GENERATE_FRAME": { frameId?: string; requestId?: string };
}

// ============================================================================
// DATA VALIDATION TYPES
// ============================================================================
export interface DataValidationResult {
  isValid: boolean;
  errors?: string[];
  data: Annotation | null;
}

export interface AnnotationChangeResult {
  added: Annotation[];
  removed: Annotation[];
  modified: Array<{
    previous: Annotation;
    current: Annotation;
  }>;
  unchanged: Annotation[];
}

// ============================================================================
// REQUEST HANDLERS (UI -> Main)
// ============================================================================

export interface SwitchPlatformHandler extends EventHandler {
  name: "SWITCH_PLATFORM";
  handler: (platform: "mobile" | "web") => void;
}

export interface SetSelectionScopeHandler extends EventHandler {
  name: "SET_SELECTION_SCOPE";
  handler: (scope: "currentPage" | "documentWide") => void;
}

export interface SelectFrameHandler extends EventHandler {
  name: "SELECT_FRAME";
  handler: (frameId: string | null) => void;
}

export interface ZoomToFrameHandler extends EventHandler {
  name: "ZOOM_TO_FRAME";
  handler: (frameId?: string | null) => void;
}

export interface CreateAnnotationHandler extends EventHandler {
  name: "CREATE_ANNOTATION";
  handler: (data?: { requestId?: string }) => void;
}

export interface GenerateFrameHandler extends EventHandler {
  name: "GENERATE_FRAME";
  handler: (data?: { frameId?: string; requestId?: string }) => void;
}

export interface UpdateAnnotationHandler extends EventHandler {
  name: "UPDATE_ANNOTATION";
  handler: (data: Partial<Annotation> & { id: number; requestId?: string }) => void;
}

export interface DeleteAnnotationHandler extends EventHandler {
  name: "DELETE_ANNOTATION";
  handler: (id: number, frameId?: string, requestId?: string) => void;
}

export interface ReorderAnnotationHandler extends EventHandler {
  name: "REORDER_ANNOTATION";
  handler: (id: number, direction: "up" | "down", requestId?: string) => void;
}

export interface InsertAnnotationsHandler extends EventHandler {
  name: "INSERT_ANNOTATIONS";
  handler: () => void;
}

export interface UpdateAnnotationsHandler extends EventHandler {
  name: "UPDATE_ANNOTATIONS";
  handler: () => void;
}

export interface ToggleAnnotationsHandler extends EventHandler {
  name: "TOGGLE_ANNOTATIONS";
  handler: (visible: boolean) => void;
}

export interface GetScreensHandler extends EventHandler {
  name: "GET_SCREENS";
  handler: () => void;
}

export interface SyncCanvasHandler extends EventHandler {
  name: "SYNC_CANVAS";
  handler: () => void;
}

export interface MigrateLegacyDataHandler extends EventHandler {
  name: "MIGRATE_LEGACY_DATA";
  handler: () => void;
}

export interface SaveDataHandler extends EventHandler {
  name: "save-data";
  handler: (data: { annotation: Annotation; requestId?: string }) => void;
}

export interface FieldUpdateRealtimeHandler extends EventHandler {
  name: "field-update-realtime";
  handler: (data: {
    annotationId: number;
    frameId: string;
    field: string;
    value: string;
    source: "ui" | "canvas";
  }) => void;
}

export interface DeleteDataHandler extends EventHandler {
  name: "delete-data";
  handler: (data: { annotationId: number; frameId: string; elementId: string; requestId?: string }) => void;
}

export interface UpdateAllAnnotationsHandler extends EventHandler {
  name: "update-annotations";
  handler: (data: { annotations: Annotation[] }) => void;
}

export interface RequestResyncHandler extends EventHandler {
  name: "request-resync";
  handler: () => void;
}

// ============================================================================
// RESPONSE HANDLERS (Main -> UI)
// ============================================================================

export interface InitHandler extends EventHandler {
  name: "INIT";
  handler: (data: {
    annotations: Annotation[];
    screens: Screen[];
    currentFrameId: string | null;
    selectionScope: "currentPage" | "documentWide";
  }) => void;
}

export interface SelectionChangedHandler extends EventHandler {
  name: "SELECTION_CHANGED";
  handler: (data: {
    count: number;
    frameInfo: {
      id: string;
      name: string;
      pageId: string;
      pageName: string;
    } | null;
  }) => void;
}

export interface FrameAutoSwitchedHandler extends EventHandler {
  name: "FRAME_AUTO_SWITCHED";
  handler: (data: {
    frameId: string;
    frameName: string;
    annotations: Annotation[];
  }) => void;
}

export interface ExpandAnnotationHandler extends EventHandler {
  name: "EXPAND_ANNOTATION";
  handler: (data: { annotationId: number }) => void;
}

export interface AnnotationCreatedHandler extends EventHandler {
  name: "ANNOTATION_CREATED";
  handler: (data: { annotation: Annotation; frameId: string; requestId?: string }) => void;
}

export interface AnnotationUpdatedHandler extends EventHandler {
  name: "ANNOTATION_UPDATED";
  handler: (data: { annotation: Partial<Annotation> & { id: number }; requestId?: string }) => void;
}

export interface AnnotationDeletedHandler extends EventHandler {
  name: "ANNOTATION_DELETED";
  handler: (data: { id: number; frameId: string; requestId?: string }) => void;
}

export interface AnnotationsReorderedHandler extends EventHandler {
  name: "ANNOTATIONS_REORDERED";
  handler: (data: { annotations: Annotation[]; requestId?: string }) => void;
}

export interface InsertCompleteHandler extends EventHandler {
  name: "INSERT_COMPLETE";
  handler: () => void;
}

export interface ScreensListHandler extends EventHandler {
  name: "SCREENS_LIST";
  handler: (data: { screens: Screen[] }) => void;
}

export interface CanvasSyncCompleteHandler extends EventHandler {
  name: "CANVAS_SYNC_COMPLETE";
  handler: (data: { annotations: Annotation[] }) => void;
}

export type Theme = "light" | "dark";

export interface UserSettings {
  // Core UI settings
  theme: Theme;

  // Selection and navigation
  selectionScope: "currentPage" | "documentWide";
}

// ============================================================================
// CIRCUIT BREAKER ERROR TYPES - For graceful degradation
// ============================================================================

/**
 * FIGMA_ERROR message payload - emitted when circuit breaker trips
 */
export interface FigmaErrorPayload {
  /** Operation that caused the error (e.g., "INSERT_ANNOTATIONS") */
  operation: string;
  /** Human-readable reason for the error */
  reason: string;
  /** Cooldown duration in ms before retry */
  cooldownMs: number;
}

/**
 * FIGMA_ERROR_CLEARED message payload - emitted when circuit breaker resets
 */
export interface FigmaErrorClearedPayload {
  /** Operation that is now available again */
  operation: string;
}

export interface FigmaErrorHandler extends EventHandler {
  name: "FIGMA_ERROR";
  handler: (data: FigmaErrorPayload) => void;
}

export interface FigmaErrorClearedHandler extends EventHandler {
  name: "FIGMA_ERROR_CLEARED";
  handler: (data: FigmaErrorClearedPayload) => void;
}

export interface UpdateUserSettingsHandler extends EventHandler {
  name: "UPDATE_USER_SETTINGS";
  handler: (data: { settings: Partial<UserSettings> }) => void;
}
