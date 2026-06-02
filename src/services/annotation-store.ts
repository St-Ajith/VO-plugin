// ============================================================================
// ANNOTATION STORE - Node plugin data is authoritative source
// ============================================================================

import { emit } from "@create-figma-plugin/utilities";
import { cloneObject } from "@create-figma-plugin/utilities";

import { syncSettings, performanceSettings, isFeatureEnabled } from "../store";
import {
  Annotation,
  NodeChangeMessages,
} from "../types";

import { Logger } from "../utils/logger";
import { removeDuplicateAnnotations } from "../utils/annotation-deduplication";
import { validateAnnotations } from "../schema/annotation-schema";
import { StorageService } from "./storage";
import { ValidationService } from "./validation";
import { CanvasService } from "./canvas";
import { SyncCoordinator } from "./sync-coordinator";
import { MigrationService } from "./migration-service";

export class AnnotationStore {
  private annotations: Annotation[] = [];

  // Storage service for node-based operations
  private readonly storage = new StorageService();

  // Validation service for data validation
  private readonly validation = new ValidationService();

  // Canvas service for table rendering and parsing
  private readonly canvas = new CanvasService();

  // Migration service for data format migrations
  private readonly migration = new MigrationService(
    this.storage,
    this.validation
  );

  // Sync coordinator for bidirectional sync
  private readonly syncCoordinator: SyncCoordinator;

  // Plugin settings integration
  private pluginSettings: {
    sync: {
      globalSyncEnabled: boolean;
      maxConcurrentSyncs: number;
      batchSize: number;
      timeoutMs: number;
    };
    performance: {
      enableMonitoring: boolean;
      logLevel: "none" | "basic" | "detailed";
      memoryThreshold: number;
      cleanupInterval: number;
    };
    features: {
      advancedValidation: boolean;
      bulkOperations: boolean;
      realTimeSync: boolean;
      debugMode: boolean;
    };
  } | null = null;

  constructor() {
    // Initialize sync coordinator with dependencies
    this.syncCoordinator = new SyncCoordinator(this.canvas, this.validation, {
      getAllAnnotations: () => this.getAll(),
      addAnnotation: (annotation: Annotation) => {
        // Validate annotation before adding
        if (!this.validation.validateCanvasAnnotation(annotation)) {
          Logger.error("Sync coordinator", "Invalid annotation - skipping", {
            id: annotation.id,
          });
          return Promise.resolve();
        }
        const validatedAnnotation = cloneObject(annotation);
        this.annotations.push(validatedAnnotation);
        this.scheduleSync();
        return Promise.resolve();
      },
      updateAnnotation: (annotation: Annotation) => {
        // Validate annotation before updating
        if (!this.validation.validateCanvasAnnotation(annotation)) {
          Logger.error(
            "Sync coordinator",
            "Invalid annotation update - skipping",
            { id: annotation.id, frameId: annotation.frameId }
          );
          return Promise.resolve();
        }
        const index = this.annotations.findIndex(
          (a) => a.id === annotation.id && a.frameId === annotation.frameId
        );
        if (index !== -1) {
          const now = Date.now();
          const validatedAnnotation = cloneObject(annotation);
          const current = this.annotations[index];
          if (!current) {
            throw new Error(`Annotation with id ${annotation.id} not found`);
          }
          const mobileData = validatedAnnotation.mobile
            ? {
                ios: {
                  ...current.mobile?.ios,
                  ...validatedAnnotation.mobile.ios,
                },
                android: {
                  ...current.mobile?.android,
                  ...validatedAnnotation.mobile.android,
                },
              }
            : current.mobile;
          const webData = validatedAnnotation.web
            ? {
                ...current.web,
                ...validatedAnnotation.web,
              }
            : current.web;
          this.annotations[index] = {
            ...current,
            ...validatedAnnotation,
            ...(mobileData && { mobile: mobileData }),
            ...(webData && { web: webData }),
            updatedAt: now,
          };
          this.scheduleSync();
        }
        return Promise.resolve();
      },
      scheduleSync: () => this.scheduleSync(),
    });
  }

  getPluginSettings(): {
    sync: {
      globalSyncEnabled: boolean;
      maxConcurrentSyncs: number;
      batchSize: number;
      timeoutMs: number;
    };
    performance: {
      enableMonitoring: boolean;
      logLevel: "none" | "basic" | "detailed";
      memoryThreshold: number;
      cleanupInterval: number;
    };
    features: {
      advancedValidation: boolean;
      bulkOperations: boolean;
      realTimeSync: boolean;
      debugMode: boolean;
    };
  } | null {
    return this.pluginSettings;
  }

  private loadPluginSettings() {
    try {
      // Use signals directly - no async needed
      const sync = syncSettings.value;
      const performance = performanceSettings.value;

      this.pluginSettings = {
        sync,
        performance,
        features: {
          advancedValidation: isFeatureEnabled("enableAdvancedValidation"),
          bulkOperations: isFeatureEnabled("enableBulkOperations"),
          realTimeSync: isFeatureEnabled("enableRealTimeSync"),
          debugMode: isFeatureEnabled("enableDebugMode"),
        },
      };

      Logger.debug("Plugin", "Plugin settings loaded", {
        syncEnabled: sync.globalSyncEnabled,
        maxConcurrent: sync.maxConcurrentSyncs,
        perfMonitoring: performance.enableMonitoring,
      });
    } catch (error) {
      Logger.warn(
        "Plugin",
        "Failed to load plugin settings, using defaults",
        error
      );
      // Use default settings
      this.pluginSettings = {
        sync: {
          globalSyncEnabled: true,
          maxConcurrentSyncs: 3,
          batchSize: 10,
          timeoutMs: 30000,
        },
        performance: {
          enableMonitoring: false,
          logLevel: "none",
          memoryThreshold: 50,
          cleanupInterval: 30,
        },
        features: {
          advancedValidation: true,
          bulkOperations: true,
          realTimeSync: false,
          debugMode: false,
        },
      };
    }
  }

  // ============================================================================
  // NODE-BASED PLUGIN DATA STORAGE (AUTHORITATIVE SOURCE)
  // Storage operations are handled by StorageService
  // ============================================================================

  async load() {
    try {
      // Load from authoritative node-based storage
      this.annotations = await this.storage.loadAllAnnotations();

      // Fallback: Try to load from legacy shared plugin data for migration
      if (this.annotations.length === 0) {
        const migratedAnnotations =
          await this.migration.migrateFromSharedData();
        this.annotations.push(...migratedAnnotations);
      }

      this.validate();

      // Perform incremental migration for version compatibility
      this.annotations = await this.migration.performIncrementalMigration(
        this.annotations
      );

      // Load plugin settings for global configuration
      this.loadPluginSettings();

      // Remove duplicate annotations for data consistency
      if (this.annotations.length > 0) {
        const originalCount = this.annotations.length;
        this.annotations = removeDuplicateAnnotations(
          this.annotations,
          this.validation
        );

        if (this.annotations.length !== originalCount) {
          Logger.info("Store", "Removed duplicates during load", {
            before: originalCount,
            after: this.annotations.length,
          });
        }
      }
    } catch (e) {
      Logger.error("Store load", e);
      this.annotations = [];
    }
  }

  private scheduleSync() {
    // No-op: Shared data sync removed, node data is authoritative
  }

  private validate() {
    const before = this.annotations.length;
    this.annotations = this.annotations.filter(
      (a) => a && a.id && a.frameId && a.elementId && a.platform
    );
    if (before !== this.annotations.length) {
      Logger.warn("Store", "Removed invalid annotations", {
        count: before - this.annotations.length,
      });
    }
  }

  async add(annotation: Annotation) {
    // Validate annotation data
    const validation = this.validation.validateAnnotationData(annotation);
    if (!validation.isValid) {
      Logger.error("Store", "Invalid annotation data", {
        annotationId: annotation.id,
        errors: validation.errors,
      });
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: false,
        error: `Invalid annotation data: ${validation.errors?.join(", ")}`,
      });
      return;
    }

    // Use validated and cloned data
    const safeAnnotation = validation.data!;

    // Check for existing annotation with same ID within the same frame
    // IDs are frame-scoped, so we only check for duplicates within the same frame
    const existingIndex = this.annotations.findIndex(
      (a) => a.id === safeAnnotation.id && a.frameId === safeAnnotation.frameId
    );
    if (existingIndex !== -1) {
      const existingAnnotation = this.annotations[existingIndex];
      if (existingAnnotation) {
        Logger.warn("Store", "Attempted to add duplicate annotation ID", {
          id: safeAnnotation.id,
          frameId: safeAnnotation.frameId,
          existingElementId: existingAnnotation.elementId,
        });
      }
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: false,
        error: `Annotation with ID ${safeAnnotation.id} already exists in frame ${safeAnnotation.frameId}`,
      });
      return;
    }

    // Add metadata
    const now = Date.now();
    const versionedAnnotation: Annotation = {
      ...safeAnnotation,
      createdAt: now,
      updatedAt: now,
    };

    // Save to authoritative node storage first
    // CRITICAL FIX: Rollback in-memory state if node save fails
    try {
      await this.storage.saveToNode(
        versionedAnnotation.elementId,
        versionedAnnotation
      );
    } catch (error) {
      Logger.error("Store", "Failed to save annotation to node", {
        annotationId: versionedAnnotation.id,
        elementId: versionedAnnotation.elementId,
        error,
      });
      // Rollback: Don't add to in-memory array since node save failed
      // Emit error to UI for user notification
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save annotation to node",
      });
      throw error; // Fail the operation if we can't save to authoritative source
    }

    // Only add to in-memory array after successful node save
    this.annotations.push(versionedAnnotation);
    this.scheduleSync();
    Logger.info("Store", "Added annotation", {
      id: versionedAnnotation.id,
      frame: versionedAnnotation.frameName,
    });
  }

  async update(id: number, data: Partial<Annotation>) {
    // CRITICAL: Use composite key (frameId + id) when frameId is available in data
    const frameId = data.frameId;
    const index = frameId
      ? this.annotations.findIndex((a) => a.id === id && a.frameId === frameId)
      : this.annotations.findIndex((a) => a.id === id);
    if (index === -1) {
      Logger.warn("Store", "Annotation not found for update", { id, frameId });
      return;
    }

    // CRITICAL FIX: Preserve original annotation for rollback
    const annotationAtIndex = this.annotations[index];
    if (!annotationAtIndex) {
      Logger.warn("Store", "Annotation not found at index", { id, frameId, index });
      return;
    }
    const originalAnnotation = this.safeCloneAnnotation(annotationAtIndex);

    // Validate the update operation
    const validation = this.validation.validateAnnotationUpdate(
      originalAnnotation,
      data
    );
    if (!validation.isValid) {
      Logger.error("Store", "Invalid annotation update", {
        annotationId: id,
        errors: validation.errors,
      });
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: false,
        error: `Invalid update data: ${validation.errors?.join(", ")}`,
      });
      return;
    }

    // Use validated data for the update
    const validatedData = validation.data!;
    const now = Date.now();
    const updatedAnnotation = {
      ...validatedData,
      updatedAt: now,
    };

    // Save to authoritative node storage first
    // CRITICAL FIX: Rollback to original if node save fails
    try {
      await this.storage.saveToNode(
        updatedAnnotation.elementId,
        updatedAnnotation
      );
    } catch (error) {
      Logger.error("Store", "Failed to update annotation on node", {
        annotationId: id,
        elementId: updatedAnnotation.elementId,
        error,
      });
      // Rollback: Restore original annotation since node save failed
      this.annotations[index] = originalAnnotation;
      // Emit error to UI for user notification
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update annotation on node",
      });
      throw error; // Fail the operation if we can't save to authoritative source
    }

    // Only update in-memory array after successful node save
    this.annotations[index] = updatedAnnotation;
    this.scheduleSync();
  }

  async delete(id: number, frameId?: string) {
    // CRITICAL: Use composite key (frameId + id) to avoid cross-frame collision
    const annotation = frameId
      ? this.annotations.find((a) => a.id === id && a.frameId === frameId)
      : this.annotations.find((a) => a.id === id);
    if (!annotation) {
      // IDEMPOTENCY: Annotation already deleted - log but don't error
      Logger.debug("Store", "Annotation already deleted (idempotent)", { id, frameId });
      return;
    }

    // CRITICAL FIX: Preserve annotation data for logging
    const elementId = annotation.elementId;
    const annotationFrameId = annotation.frameId;

    // Remove from authoritative node storage first
    // CRITICAL FIX: Handle node removal failures gracefully
    try {
      await this.storage.removeFromNode(elementId);
    } catch (error) {
      Logger.error("Store", "Failed to remove annotation from node", {
        annotationId: id,
        frameId: annotationFrameId,
        elementId: elementId,
        error,
      });
      // Continue with deletion even if node removal fails
      // (node might have been deleted already, or deletion is still valid)
      // Emit warning but don't fail the operation
      emit("save-data-result" as keyof NodeChangeMessages, {
        success: true, // Still consider success since in-memory deletion is valid
        error:
          error instanceof Error
            ? error.message
            : "Node removal failed but deletion proceeded",
      });
    }

    // Remove from in-memory array using composite key
    // (node might have been deleted already, so this is still valid)
    this.annotations = frameId
      ? this.annotations.filter((a) => !(a.id === id && a.frameId === frameId))
      : this.annotations.filter((a) => a.id !== id);
    this.scheduleSync();
    Logger.info("Store", "Deleted annotation", { id, frameId: annotationFrameId });
  }

  getAll(): Annotation[] {
    return [...this.annotations];
  }

  getByFrame(frameId: string): Annotation[] {
    return this.annotations.filter((a) => a.frameId === frameId);
  }

  getNextId(frameId: string): number {
    const frameAnn = this.getByFrame(frameId);
    if (frameAnn.length === 0) return 1;

    const used = new Set(frameAnn.map((a) => a.id));
    let num = 1;
    while (used.has(num)) num++;
    return num;
  }

  // ============================================================================
  // PUBLIC ACCESS METHODS - For external access to node operations
  // ============================================================================

  // Public method to load annotation from a node
  async getAnnotationFromNode(nodeId: string): Promise<Annotation | null> {
    return await this.storage.loadFromNode(nodeId);
  }

  // Public method to directly set annotations (used by sync direction)
  // Validates incoming annotations with Valibot and filters out invalid entries
  setAnnotations(annotations: Annotation[]) {
    // Validate all annotations using Valibot schema
    const { valid, invalidCount } = validateAnnotations(annotations);
    
    if (invalidCount > 0) {
      Logger.warn("Store", "Rejected invalid annotations in setAnnotations", {
        total: annotations.length,
        valid: valid.length,
        invalid: invalidCount,
      });
    }
    
    this.annotations = valid;
  }

  reorder(id: number, direction: "up" | "down") {
    // Find the annotation to reorder
    const annotation = this.annotations.find((a) => a.id === id);
    if (!annotation) return;

    // Get only annotations from the same frame (reorder is frame-scoped)
    const frameId = annotation.frameId;
    const frameAnnotations = this.annotations.filter((a) => a.frameId === frameId);
    
    // Find the index within the frame's annotations
    const frameIdx = frameAnnotations.findIndex((a) => a.id === id);
    if (frameIdx === -1) return;

    // Calculate the new index within the frame
    const newFrameIdx = direction === "up" ? frameIdx - 1 : frameIdx + 1;
    if (newFrameIdx < 0 || newFrameIdx >= frameAnnotations.length) return;

    // Get the annotation to swap with
    const swapAnnotation = frameAnnotations[newFrameIdx];
    if (!swapAnnotation) return;

    // Find their global indices in the full annotations array
    const globalIdx = this.annotations.findIndex((a) => a.id === id && a.frameId === frameId);
    const swapGlobalIdx = this.annotations.findIndex((a) => a.id === swapAnnotation.id && a.frameId === frameId);
    
    if (globalIdx === -1 || swapGlobalIdx === -1) return;

    // Swap the annotations in the global array
    const annotationAtIdx = this.annotations[globalIdx];
    const annotationAtSwapIdx = this.annotations[swapGlobalIdx];
    if (!annotationAtIdx || !annotationAtSwapIdx) return;
    
    [this.annotations[globalIdx], this.annotations[swapGlobalIdx]] = [
      annotationAtSwapIdx,
      annotationAtIdx,
    ];

    // Reordering affects node storage (order is maintained in node data)
    this.scheduleSync();
  }

  // Force immediate sync to shared plugin data (useful for plugin close/unload)
  async forceSync() {
    // No-op: Shared data sync removed, node data is authoritative
  }

  // ============================================================================
  // BIDIRECTIONAL SYNC - Canvas <-> Cache Synchronization
  // ============================================================================

  // Check for canvas changes and sync bidirectionally
  // @returns Array of annotation IDs that were found on the canvas (have tables)
  async checkCanvasSync(): Promise<number[]> {
    return await this.syncCoordinator.checkCanvasSync();
  }

  private safeCloneAnnotation(annotation: Annotation): Annotation {
    // Use cloneObject for safe deep cloning
    return cloneObject(annotation);
  }

  clearCanvasTableCache(): void {
    this.syncCoordinator.clearCanvasTableCache();
  }

  async updateFromCanvas(canvasAnnotation: Annotation): Promise<void> {
    await this.syncCoordinator.updateFromCanvas(canvasAnnotation);
  }
}
