// ============================================================================
// SYNC COORDINATOR TESTS - Change Detection Logic
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SyncCoordinator, SyncCoordinatorDependencies } from "../../services/sync-coordinator";
import { ValidationService } from "../../services/validation";
import { CanvasService } from "../../services/canvas";
import {
  createMobileAnnotation,
  createWebAnnotation,
  createAnnotationSet,
} from "../fixtures/annotations";
import type { Annotation } from "../../types";
import { mockConsole } from "../utils/test-helpers";

describe("SyncCoordinator", () => {
  let syncCoordinator: SyncCoordinator;
  let validation: ValidationService;
  let mockDependencies: SyncCoordinatorDependencies;
  let mockAnnotations: Annotation[];

  beforeEach(() => {
    validation = new ValidationService();
    mockAnnotations = [];
    
    // Create mock dependencies
    mockDependencies = {
      getAllAnnotations: vi.fn(() => mockAnnotations),
      addAnnotation: vi.fn(),
      updateAnnotation: vi.fn(),
      scheduleSync: vi.fn(),
    };

    // Create a minimal mock canvas service
    const mockCanvasService = {
      parseAnnotationFromTable: vi.fn(),
      createAnnotationTable: vi.fn(),
      deleteAnnotationArtifacts: vi.fn(),
    } as unknown as CanvasService;

    syncCoordinator = new SyncCoordinator(
      mockCanvasService,
      validation,
      mockDependencies
    );
  });

  // ==========================================================================
  // detectAnnotationChanges tests
  // ==========================================================================

  describe("detectAnnotationChanges", () => {
    it("should identify added annotations", () => {
      const consoleMock = mockConsole();
      const previous: Annotation[] = [];
      const current = [createMobileAnnotation({ id: 1 })];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.added).toHaveLength(1);
      const firstAdded = changes.added[0]!;
      expect(firstAdded).toBeDefined();
      expect(firstAdded.id).toBe(1);
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
      consoleMock.restore();
    });

    it("should identify multiple added annotations", () => {
      const consoleMock = mockConsole();
      const previous: Annotation[] = [];
      const current = [
        createMobileAnnotation({ id: 1 }),
        createMobileAnnotation({ id: 2, elementId: "element-2" }),
        createWebAnnotation({ id: 3, elementId: "element-3" }),
      ];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.added).toHaveLength(3);
      expect(changes.added.map((a) => a.id)).toEqual([1, 2, 3]);
      consoleMock.restore();
    });

    it("should identify removed annotations", () => {
      const consoleMock = mockConsole();
      const previous = [createMobileAnnotation({ id: 1 })];
      const current: Annotation[] = [];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.removed).toHaveLength(1);
      const firstRemoved = changes.removed[0]!;
      expect(firstRemoved).toBeDefined();
      expect(firstRemoved.id).toBe(1);
      expect(changes.added).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
      consoleMock.restore();
    });

    it("should identify multiple removed annotations", () => {
      const consoleMock = mockConsole();
      const previous = [createMobileAnnotation({ id: 1 }), createMobileAnnotation({ id: 2, elementId: "element-2" })];
      const current: Annotation[] = [];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.removed).toHaveLength(2);
      expect(changes.removed.map((a) => a.id)).toEqual([1, 2]);
      consoleMock.restore();
    });

    it("should identify modified annotations", () => {
      const consoleMock = mockConsole();
      const now = Date.now();
      const previous = [
        createMobileAnnotation({
          id: 1,
          voicedPreview: "Original",
          updatedAt: now,
        }),
      ];
      const current = [
        createMobileAnnotation({
          id: 1,
          voicedPreview: "Modified",
          updatedAt: now + 1000,
        }),
      ];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.modified).toHaveLength(1);
      const firstModified = changes.modified[0]!;
      expect(firstModified).toBeDefined();
      expect(firstModified.previous.voicedPreview).toBe("Original");
      expect(firstModified.current.voicedPreview).toBe("Modified");
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
      consoleMock.restore();
    });

    it("should identify unchanged annotations", () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation({ id: 1 });
      const previous = [annotation];
      // Create identical copy
      const current = [{ ...annotation }];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.unchanged).toHaveLength(1);
      const firstUnchanged = changes.unchanged[0]!;
      expect(firstUnchanged).toBeDefined();
      expect(firstUnchanged.id).toBe(1);
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      consoleMock.restore();
    });

    it("should handle mixed changes", () => {
      const consoleMock = mockConsole();
      const { original, modified, added, removed } = createAnnotationSet();

      const changes = syncCoordinator.detectAnnotationChanges(original, modified);

      // annotation3 was removed
      expect(changes.removed).toHaveLength(1);
      const firstRemoved = changes.removed[0]!;
      expect(firstRemoved).toBeDefined();
      expect(firstRemoved.id).toBe(removed.id);

      // annotation4 was added
      expect(changes.added).toHaveLength(1);
      const firstAdded = changes.added[0]!;
      expect(firstAdded).toBeDefined();
      expect(firstAdded.id).toBe(added.id);

      // annotation2 was modified
      expect(changes.modified).toHaveLength(1);
      const firstModified = changes.modified[0]!;
      expect(firstModified).toBeDefined();
      expect(firstModified.previous.id).toBe(2);
      expect(firstModified.current.id).toBe(2);

      // annotation1 was unchanged
      expect(changes.unchanged).toHaveLength(1);
      const firstUnchanged = changes.unchanged[0]!;
      expect(firstUnchanged).toBeDefined();
      expect(firstUnchanged.id).toBe(1);
      consoleMock.restore();
    });

    it("should handle empty arrays", () => {
      const consoleMock = mockConsole();
      const previous: Annotation[] = [];
      const current: Annotation[] = [];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
      consoleMock.restore();
    });

    it("should detect modifications in nested mobile data", () => {
      const consoleMock = mockConsole();
      const now = Date.now();
      const previous = [
        createMobileAnnotation({
          id: 1,
          updatedAt: now,
          mobile: {
            ios: { label: "Original", value: "", trait: "Button", hint: "" },
            android: { label: "Original", value: "", trait: "Button", hint: "" },
          },
        }),
      ];
      const current = [
        createMobileAnnotation({
          id: 1,
          updatedAt: now,
          mobile: {
            ios: { label: "Modified", value: "", trait: "Button", hint: "" },
            android: { label: "Original", value: "", trait: "Button", hint: "" },
          },
        }),
      ];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.modified).toHaveLength(1);
      consoleMock.restore();
    });

    it("should detect modifications in nested web data", () => {
      const consoleMock = mockConsole();
      const now = Date.now();
      const previous = [
        createWebAnnotation({
          id: 1,
          updatedAt: now,
          web: {
            ariaLabel: "Original",
            role: "button",
            ariaDescribedBy: "",
            tabIndex: "0",
          },
        }),
      ];
      const current = [
        createWebAnnotation({
          id: 1,
          updatedAt: now,
          web: {
            ariaLabel: "Modified",
            role: "button",
            ariaDescribedBy: "",
            tabIndex: "0",
          },
        }),
      ];

      const changes = syncCoordinator.detectAnnotationChanges(previous, current);

      expect(changes.modified).toHaveLength(1);
      consoleMock.restore();
    });
  });

  // ==========================================================================
  // clearCanvasTableCache tests
  // ==========================================================================

  describe("clearCanvasTableCache", () => {
    it("should clear the cache without errors", () => {
      const consoleMock = mockConsole();
      // Should not throw
      expect(() => syncCoordinator.clearCanvasTableCache()).not.toThrow();
      consoleMock.restore();
    });
  });
});
