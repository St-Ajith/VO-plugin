import { emit, compareObjects, cloneObject } from "@create-figma-plugin/utilities";

import {
  Annotation,
  AnnotationUpdatedHandler,
  AnnotationChangeResult,
} from "../types";

import { Logger } from "../utils/logger";
import { ValidationService } from "./validation";
import { CanvasService } from "./canvas";

// ============================================================================
// SYNC COORDINATOR - Bidirectional sync between canvas and cache
// ============================================================================

export interface SyncCoordinatorDependencies {
  getAllAnnotations: () => Annotation[];
  addAnnotation: (annotation: Annotation) => Promise<void>;
  updateAnnotation: (annotation: Annotation) => Promise<void>;
  scheduleSync: () => void;
}

export class SyncCoordinator {
  private canvasTableCache = new Map<
    string,
    { tables: FrameNode[]; timestamp: number }
  >();
  private readonly CANVAS_CACHE_TTL = 5000; // 5 seconds

  constructor(
    private canvasService: CanvasService,
    private validation: ValidationService,
    private dependencies: SyncCoordinatorDependencies
  ) {}

  // ============================================================================
  // MAIN SYNC METHOD
  // ============================================================================

  /**
   * Check for canvas changes and sync bidirectionally
   * @returns Array of annotation IDs that were found on the canvas (have tables)
   */
  async checkCanvasSync(): Promise<number[]> {
    try {
      Logger.debug("Canvas sync", "Starting canvas sync check");

      // Use safe operation for canvas reading with empty array fallback
      const rawCanvasAnnotations =
        (await this.safeCanvasOperation(
          () => this.readFromCanvas(),
          "readFromCanvas",
          []
        )) || [];

      // Validate and clean canvas annotations
      const canvasAnnotations =
        this.validation.validateAndCleanCanvasAnnotations(rawCanvasAnnotations);

      const cacheAnnotations = this.dependencies.getAllAnnotations();

      Logger.debug(
        "Canvas sync",
        `Found ${canvasAnnotations.length} canvas annotations (${rawCanvasAnnotations.length} raw), ${cacheAnnotations.length} cached annotations`
      );

      // Detect changes between canvas and cache for comprehensive sync
      const changes = this.detectAnnotationChanges(
        cacheAnnotations,
        canvasAnnotations
      );

      Logger.debug("Canvas sync", "Detected changes", {
        added: changes.added.length,
        removed: changes.removed.length,
        modified: changes.modified.length,
        unchanged: changes.unchanged.length,
      });

      // Track annotation IDs found on canvas (they have tables)
      const annotationsWithTables: number[] = [];

      // 1. Process ADDED annotations
      for (const canvasAnn of changes.added) {
        Logger.info("Canvas sync", "Found new annotation in canvas", {
          id: canvasAnn.id,
        });
        await this.addFromCanvas(canvasAnn);
        annotationsWithTables.push(canvasAnn.id);
      }

      // 2. Process UNCHANGED annotations
      for (const unchangedAnn of changes.unchanged) {
        annotationsWithTables.push(unchangedAnn.id);
      }

      // 3. Process MODIFIED annotations
      for (const change of changes.modified) {
        const cachedTime = change.previous.updatedAt || 0;
        const canvasTime = change.current.updatedAt || 0;

        // Modified annotations have tables on canvas - track them
        annotationsWithTables.push(change.current.id);

        // Logic: Canvas wins if newer OR if content conflicts (visual source of truth)
        if (canvasTime > cachedTime) {
          Logger.debug("Canvas sync", "Canvas timestamp is newer - updating", {
            id: change.current.id,
          });
          await this.updateFromCanvas(change.current);
          emit<AnnotationUpdatedHandler>("ANNOTATION_UPDATED", {
            annotation: change.current,
          });
        } else if (cachedTime > canvasTime) {
          Logger.debug(
            "Canvas sync",
            "Cache timestamp is newer - keeping cached",
            {
              id: change.previous.id,
            }
          );
        } else {
          // Timestamp tie-breaker: Content check
          if (this.hasContentChanged(change.previous, change.current)) {
            Logger.debug("Canvas sync", "Content conflict - canvas wins", {
              id: change.current.id,
            });
            await this.updateFromCanvas(change.current);
            emit<AnnotationUpdatedHandler>("ANNOTATION_UPDATED", {
              annotation: change.current,
            });
          }
        }
      }

      return annotationsWithTables;
    } catch (error) {
      Logger.error("Canvas sync", "Canvas sync failed", error);
      return [];
    }
  }

  // ============================================================================
  // CANVAS READING
  // ============================================================================

  async readFromCanvas(): Promise<Annotation[]> {
    const canvasAnnotations: Annotation[] = [];

    try {
      // Optimized table discovery (No global fallback)
      const annotationTables = await this.findAnnotationTablesOptimized();

      for (const table of annotationTables) {
        // Double check table still exists before parsing (async race condition protection)
        if (table.removed) continue;

        const annotation = await this.safeCanvasOperation(
          () => this.canvasService.parseAnnotationFromTable(table),
          `parseAnnotationFromTable-${table.id}`,
          null
        );

        if (annotation) {
          canvasAnnotations.push(annotation);
        }
      }

      Logger.info("Canvas read", "Found annotations", {
        count: canvasAnnotations.length,
      });
    } catch (error) {
      Logger.error("Canvas read", error);
    }

    return canvasAnnotations;
  }

  // ============================================================================
  // CHANGE DETECTION
  // ============================================================================

  detectAnnotationChanges(
    previous: Annotation[],
    current: Annotation[]
  ): AnnotationChangeResult {
    const changes: AnnotationChangeResult = {
      added: [],
      removed: [],
      modified: [],
      unchanged: [],
    };

    // Use composite key (frameId:id) since IDs are frame-scoped
    const previousMap = new Map(previous.map((a) => [`${a.frameId}:${a.id}`, a]));
    const currentMap = new Map(current.map((a) => [`${a.frameId}:${a.id}`, a]));

    for (const currentAnn of current) {
      const compositeKey = `${currentAnn.frameId}:${currentAnn.id}`;
      const previousAnn = previousMap.get(compositeKey);

      if (!previousAnn) {
        changes.added.push(currentAnn);
      } else if (!compareObjects(previousAnn, currentAnn)) {
        changes.modified.push({
          previous: previousAnn,
          current: currentAnn,
        });
      } else {
        changes.unchanged.push(currentAnn);
      }
    }

    for (const previousAnn of previous) {
      const compositeKey = `${previousAnn.frameId}:${previousAnn.id}`;
      if (!currentMap.has(compositeKey)) {
        changes.removed.push(previousAnn);
      }
    }

    return changes;
  }

  private hasContentChanged(cached: Annotation, canvas: Annotation): boolean {
    // Compare platform specific fields
    if (cached.platform === "mobile" && cached.mobile && canvas.mobile) {
      return !compareObjects(cached.mobile, canvas.mobile);
    } else if (cached.platform === "web" && cached.web && canvas.web) {
      return !compareObjects(cached.web, canvas.web);
    }
    return false;
  }

  // ============================================================================
  // CANVAS UPDATE OPERATIONS
  // ============================================================================

  private async addFromCanvas(annotation: Annotation): Promise<void> {
    if (!this.validation.validateCanvasAnnotation(annotation)) {
      Logger.error("Canvas sync", "Invalid annotation from canvas - skipping", {
        id: annotation.id,
      });
      return;
    }
    const validatedAnnotation = cloneObject(annotation);
    await this.dependencies.addAnnotation(validatedAnnotation);
    this.dependencies.scheduleSync();
  }

  async updateFromCanvas(canvasAnnotation: Annotation): Promise<void> {
    if (!this.validation.validateCanvasAnnotation(canvasAnnotation)) {
      Logger.error(
        "Canvas sync",
        "Invalid annotation update from canvas - skipping",
        {
          id: canvasAnnotation.id,
        }
      );
      return;
    }
    const validatedCanvasAnnotation = cloneObject(canvasAnnotation);
    await this.dependencies.updateAnnotation(validatedCanvasAnnotation);
    this.dependencies.scheduleSync();
  }

  // ============================================================================
  // CANVAS PERFORMANCE OPTIMIZATION
  // ============================================================================

  private getCachedAnnotationTables(pageId: string): FrameNode[] | null {
    const cached = this.canvasTableCache.get(pageId);
    if (cached && Date.now() - cached.timestamp < this.CANVAS_CACHE_TTL) {
      // Verify cached nodes still exist (haven't been deleted since cache)
      const validTables = cached.tables.filter((t) => !t.removed);
      if (validTables.length !== cached.tables.length) {
        // If some were deleted, invalidate cache for safety
        return null;
      }
      return validTables;
    }
    return null;
  }

  private setCachedAnnotationTables(pageId: string, tables: FrameNode[]): void {
    this.canvasTableCache.set(pageId, {
      tables: [...tables],
      timestamp: Date.now(),
    });
  }

  /**
   * Get tables from container for a specific frame (O(1) lookup)
   */
  private getTablesFromContainer(frameId: string): FrameNode[] {
    const containerName = `Annotation Container - ${frameId}`;
    const container = figma.currentPage.findOne(
      (node) => node.name === containerName && node.type === "FRAME"
    ) as FrameNode | null;

    if (!container || container.removed) {
      return [];
    }

    // Find table column
    const tableColumn = container.children.find(
      (child) => child.type === "FRAME" && child.name === "Table Column"
    ) as FrameNode | undefined;

    if (!tableColumn) {
      return [];
    }

    // Return all tables from table column
    return tableColumn.children.filter(
      (child) => child.type === "FRAME" && child.name.startsWith("Annotation Table")
    ) as FrameNode[];
  }

  /**
   * Optimized table discovery strategy:
   * 1. Try container-based lookup first (O(1) per frame)
   * 2. Fall back to page scan for legacy tables
   * 3. Load all pages (Required once).
   * 4. Iterate pages manually (Avoids root.findAll).
   * 5. Use Cache per page.
   * 6. Isolate failures per page (One bad page doesn't break the app).
   */
  private async findAnnotationTablesOptimized(): Promise<FrameNode[]> {
    const startTime = Date.now();
    const allTables: FrameNode[] = [];

    // 1. Load context
    await figma.loadAllPagesAsync();

    // 2. Try container-based discovery first (if we know frame IDs)
    // For now, we'll scan for containers and extract tables from them
    const pages = figma.root.children;
    const containerTables: FrameNode[] = [];

    for (const page of pages) {
      if (page.type !== "PAGE") continue;

      try {
        // Find all containers on this page
        const containers = page.findAll((node) => {
          return (
            node.type === "FRAME" &&
            node.name.startsWith("Annotation Container") &&
            node.visible !== false
          );
        }) as FrameNode[];

        // Extract tables from each container
        for (const container of containers) {
          const tableColumn = container.children.find(
            (child) => child.type === "FRAME" && child.name === "Table Column"
          ) as FrameNode | undefined;

          if (tableColumn) {
            const tables = tableColumn.children.filter(
              (child) =>
                child.type === "FRAME" &&
                child.name.startsWith("Annotation Table") &&
                child.visible !== false
            ) as FrameNode[];
            containerTables.push(...tables);
          }
        }
      } catch (error) {
        Logger.warn("Canvas performance", `Failed to scan containers on page ${page.name}`, {
          error,
        });
      }
    }

    // 3. Fall back to legacy page scan for tables not in containers
    for (const page of pages) {
      // Skip non-page nodes (rare but possible in some API versions)
      if (page.type !== "PAGE") continue;

      try {
        // Check Cache
        const cachedTables = this.getCachedAnnotationTables(page.id);
        if (cachedTables) {
          // Filter out tables that are already in containers
          const legacyTables = cachedTables.filter(
            (table) => !containerTables.some((ct) => ct.id === table.id)
          );
          allTables.push(...legacyTables);
          continue;
        }

        // Scan Page for legacy tables
        // limiting scope to just this page is much faster than root scan
        const pageTables = page.findAll((node) => {
          return (
            node.type === "FRAME" &&
            node.name.startsWith("Annotation Table") &&
            node.visible !== false
          );
        }) as FrameNode[];

        // Filter out tables that are already in containers
        const legacyTables = pageTables.filter(
          (table) => !containerTables.some((ct) => ct.id === table.id)
        );

        // Update Cache
        this.setCachedAnnotationTables(page.id, legacyTables);
        allTables.push(...legacyTables);
      } catch (error) {
        // Error Isolation
        // If one page fails (e.g., "Node not found" or permission error),
        // log it and continue to the next page. Do NOT fail the whole sync.
        Logger.warn("Canvas performance", `Failed to scan page ${page.name}`, {
          error,
        });
      }
    }

    // Combine container tables with legacy tables
    allTables.push(...containerTables);

    const duration = Date.now() - startTime;
    Logger.debug(
      "Canvas performance",
      `Table discovery completed in ${duration}ms`,
      {
        totalTables: allTables.length,
        containerTables: containerTables.length,
        legacyTables: allTables.length - containerTables.length,
        pagesSearched: pages.length,
      }
    );

    return allTables;
  }

  clearCanvasTableCache(): void {
    this.canvasTableCache.clear();
    Logger.debug("Canvas performance", "Table cache cleared");
  }

  // ============================================================================
  // SAFE OPERATIONS
  // ============================================================================

  private async safeCanvasOperation<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      Logger.warn("Canvas operation", `Safe operation failed: ${context}`, {
        error,
      });
      if (fallback !== undefined) return fallback;
      throw error;
    }
  }
}
