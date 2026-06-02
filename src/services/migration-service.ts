// ============================================================================
// MIGRATION SERVICE - Handle annotation data format migrations
// ============================================================================

import { cloneObject, compareObjects } from "@create-figma-plugin/utilities";

import { Annotation } from "../types";
import { Logger } from "../utils/logger";
import { StorageService } from "./storage";
import { ValidationService } from "./validation";

// Legacy annotation format (may be missing some fields)
interface LegacyAnnotation {
  id: number;
  frameId: string;
  frameName: string;
  pageId?: string;
  pageName?: string;
  platform: "mobile" | "web";
  elementId: string;
  elementName: string;
  voicedPreview: string;
  createdAt?: number;
  updatedAt?: number;
  mobile?: {
    ios?: { label?: string; value?: string; trait?: string; hint?: string };
    android?: { label?: string; value?: string; trait?: string; hint?: string };
  };
  web?: {
    ariaLabel?: string;
    role?: string;
    ariaDescribedBy?: string;
    tabIndex?: string;
  };
}

export class MigrationService {
  private readonly NAMESPACE = "voice_over_annotations";
  private readonly SHARED_KEY = "data"; // Legacy - for migration

  constructor(
    private storage: StorageService,
    private validation: ValidationService
  ) {}

  /**
   * Migrate old annotation format to new format with version tracking.
   * Add metadata defaults if missing.
   */
  migrateAnnotation(annotation: LegacyAnnotation | Partial<Annotation>): Annotation {
    const now = Date.now();

    // Metadata defaults if missing
    const createdAt = annotation.createdAt ?? now;
    // updatedAt defaults to createdAt value if not provided
    const updatedAt = annotation.updatedAt ?? createdAt;

    // Platform-specific data with defaults
    const mobile = annotation.mobile
      ? {
          ios: {
            label: annotation.mobile.ios?.label ?? "",
            value: annotation.mobile.ios?.value ?? "",
            trait: annotation.mobile.ios?.trait ?? "",
            hint: annotation.mobile.ios?.hint ?? "",
          },
          android: {
            label: annotation.mobile.android?.label ?? "",
            value: annotation.mobile.android?.value ?? "",
            trait: annotation.mobile.android?.trait ?? "",
            hint: annotation.mobile.android?.hint ?? "",
          },
        }
      : undefined;

    const web = annotation.web
      ? {
          ariaLabel: annotation.web.ariaLabel ?? "",
          role: annotation.web.role ?? "",
          ariaDescribedBy: annotation.web.ariaDescribedBy ?? "n/a",
          tabIndex: annotation.web.tabIndex ?? "0",
        }
      : undefined;

    // Preserve all existing annotation fields
    const migrated: Annotation = {
      id: annotation.id ?? 0,
      frameId: annotation.frameId ?? "",
      frameName: annotation.frameName ?? "",
      pageId: annotation.pageId ?? "",
      pageName: annotation.pageName ?? "",
      platform: (annotation.platform as "mobile" | "web") ?? "mobile",
      elementId: annotation.elementId ?? "",
      elementName: annotation.elementName ?? "",
      voicedPreview: annotation.voicedPreview ?? "",
      targetElementId: (annotation as Partial<Annotation>).targetElementId ?? null,
      // Metadata fields with defaults if missing
      createdAt: createdAt,
      updatedAt: updatedAt,
      // Platform-specific data
      ...(mobile && { mobile }),
      ...(web && { web }),
    };

    return migrated;
  }

  /**
   * Migrate from old shared plugin data storage to node-based storage.
   */
  async migrateFromSharedData(): Promise<Annotation[]> {
    const migratedAnnotations: Annotation[] = [];

    try {
      const sharedData = figma.root.getSharedPluginData(
        this.NAMESPACE,
        this.SHARED_KEY
      );

      if (sharedData) {
        const parsed = JSON.parse(sharedData) as unknown;
        if (Array.isArray(parsed)) {
          const sharedAnnotations = (parsed as LegacyAnnotation[]).map(
            this.migrateAnnotation.bind(this)
          );

          // Migrate each annotation to node-based storage
          for (const annotation of sharedAnnotations) {
            try {
              await this.storage.saveToNode(annotation.elementId, annotation);
              migratedAnnotations.push(annotation);
            } catch (error) {
              Logger.warn("Migration", "Failed to migrate annotation to node", {
                annotationId: annotation.id,
                error,
              });
            }
          }

          Logger.info(
            "Migration",
            "Migrated from shared data to node storage",
            {
              count: sharedAnnotations.length,
            }
          );

          // Clear old shared data after successful migration
          figma.root.setSharedPluginData(this.NAMESPACE, this.SHARED_KEY, "");
        }
      }
    } catch (error) {
      Logger.warn("Migration", "Failed to migrate from shared data", error);
    }

    return migratedAnnotations;
  }

  /**
   * Migrate annotation data from one version to another.
   */
  migrateAnnotationData(
    sourceData: Partial<Annotation>,
    sourceVersion: number = 1,
    targetVersion: number = 2
  ): Annotation {
    try {
      Logger.debug(
        "Migration",
        `Migrating annotation from v${sourceVersion} to v${targetVersion}`,
        {
          sourceId: sourceData.id ?? "unknown",
        }
      );

      // Start with a safe clone of source data
      let migratedData: Partial<Annotation> = cloneObject(sourceData);

      // Apply version-specific transformations
      for (
        let version = sourceVersion + 1;
        version <= targetVersion;
        version++
      ) {
        migratedData = this.applyVersionMigration(migratedData, version);
      }

      // Convert to a concrete Annotation before validation (fill defaults)
      const finalAnnotation = this.migrateAnnotation(migratedData);
      // Validate the migrated data
      const validation = this.validation.validateAnnotationData(finalAnnotation);
      if (!validation.isValid) {
        Logger.error("Migration", "Migrated data validation failed", {
          sourceId: sourceData.id,
          errors: validation.errors,
        });
        throw new Error(
          `Migration validation failed: ${validation.errors?.join(", ")}`
        );
      }

      // Set timestamps
      finalAnnotation.updatedAt = Date.now();

      Logger.debug("Migration", "Annotation migration successful", {
        sourceId: sourceData.id,
        finalVersion: targetVersion,
      });

      return finalAnnotation;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(
        "Migration",
        `Annotation migration failed: ${errorMessage}`,
        {
          sourceId: sourceData.id,
          sourceVersion,
          targetVersion,
        }
      );
      throw error;
    }
  }

  /**
   * Apply version-specific migration transformations.
   */
  private applyVersionMigration(
    data: Partial<Annotation>,
    targetVersion: number
  ): Partial<Annotation> {
    const migratedData = cloneObject(data);

    switch (targetVersion) {
      case 2:
        // Version 2 migrations: Add new required fields, normalize data structure
        migratedData.pageId = migratedData.pageId ?? "";
        migratedData.pageName = migratedData.pageName ?? "";
        migratedData.createdAt = migratedData.createdAt ?? Date.now();
        migratedData.updatedAt = migratedData.updatedAt ?? Date.now();

        // Normalize platform-specific data
        if (migratedData.platform === "mobile" && migratedData.mobile) {
          migratedData.mobile.ios = migratedData.mobile.ios ?? {
            label: "",
            value: "",
            trait: "",
            hint: "",
          };
          migratedData.mobile.android = migratedData.mobile.android ?? {
            label: "",
            value: "",
            trait: "",
            hint: "",
          };
        } else if (migratedData.platform === "web" && migratedData.web) {
          // Web data structure is already normalized
        }
        break;

      case 3:
        // Future version migrations can be added here
        Logger.debug("Migration", "Applying version 3 transformations");
        break;

      default:
        Logger.warn("Migration", `Unknown target version: ${targetVersion}`);
    }

    return migratedData;
  }

  /**
   * Validate migration integrity by comparing original and migrated data.
   */
  validateMigrationIntegrity(
    originalData: Annotation[],
    migratedData: Annotation[]
  ): boolean {
    try {
      if (originalData.length !== migratedData.length) {
        Logger.error("Migration", "Data count mismatch after migration", {
          originalCount: originalData.length,
          migratedCount: migratedData.length,
        });
        return false;
      }

      // Validate each migrated annotation
      for (const migrated of migratedData) {
        const validation = this.validation.validateAnnotationData(migrated);
        if (!validation.isValid) {
          Logger.error("Migration", "Migrated annotation validation failed", {
            id: migrated.id,
            errors: validation.errors,
          });
          return false;
        }
      }

      // Check for data loss by comparing IDs
      const originalIds = originalData.map((a) => a.id).sort();
      const migratedIds = migratedData.map((a) => a.id).sort();

      if (!compareObjects(originalIds, migratedIds)) {
        Logger.error("Migration", "ID mismatch after migration", {
          originalIds,
          migratedIds,
        });
        return false;
      }

      Logger.info("Migration", "Migration integrity validation passed");
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error("Migration", `Integrity validation failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Perform incremental migration for version compatibility.
   * Migrates annotations that are missing required metadata fields.
   */
  async performIncrementalMigration(
    annotations: Annotation[]
  ): Promise<Annotation[]> {
    try {
      Logger.info("Migration", "Starting incremental migration check");

      // Check current data for migration compatibility
      const needsMigration = annotations.some((annotation) => {
        return !annotation.createdAt || !annotation.updatedAt;
      });

      if (!needsMigration) {
        Logger.debug("Migration", "No incremental migration needed");
        return annotations;
      }

      Logger.info("Migration", "Performing incremental migration", {
        outdatedCount: annotations.filter(
          (a) => !a.createdAt || !a.updatedAt
        ).length,
      });

      const originalData = cloneObject(annotations);
      const migratedAnnotations: Annotation[] = [];

      for (const annotation of annotations) {
        try {
          if (!annotation.createdAt || !annotation.updatedAt) {
            const migrated = this.migrateAnnotationData(annotation, 1, 2);
            migratedAnnotations.push(migrated);

            // Update node storage with migrated data
            await this.storage.saveToNode(migrated.elementId, migrated);
          } else {
            migratedAnnotations.push(annotation);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          Logger.error(
            "Migration",
            `Failed to migrate annotation ${annotation.id}: ${errorMessage}`
          );
          // Keep original data on migration failure
          migratedAnnotations.push(annotation);
        }
      }

      // Validate migration integrity
      const integrityValid = this.validateMigrationIntegrity(
        originalData,
        migratedAnnotations
      );
      if (!integrityValid) {
        Logger.error(
          "Migration",
          "Migration integrity check failed - rolling back"
        );
        return annotations; // Return original data on integrity failure
      }

      Logger.info("Migration", "Incremental migration completed successfully", {
        migratedCount: migratedAnnotations.length,
      });

      return migratedAnnotations;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Logger.error(
        "Migration",
        `Incremental migration failed: ${errorMessage}`
      );
      return annotations; // Return original data on error
    }
  }
}

