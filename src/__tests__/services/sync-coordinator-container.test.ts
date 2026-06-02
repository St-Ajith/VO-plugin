// ============================================================================
// SYNC COORDINATOR CONTAINER TESTS - Container-Based Discovery
// ============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SyncCoordinator,
  SyncCoordinatorDependencies,
} from "../../services/sync-coordinator";
import { ValidationService } from "../../services/validation";
import { CanvasService } from "../../services/canvas";
import { AnnotationStore } from "../../services/annotation-store";
import { createMockFigma, MockFrameNode, MockNode } from "../mocks/figma";
import { createMobileAnnotation } from "../fixtures/annotations";
import type { Annotation } from "../../types";
import { mockConsole } from "../utils/test-helpers";

// Mock computeBoundingBox
vi.mock("@create-figma-plugin/utilities", async () => {
  const actual = await vi.importActual("@create-figma-plugin/utilities");
  return {
    ...actual,
    computeBoundingBox: vi.fn((node: MockFrameNode) => {
      return {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      };
    }),
    loadFontsAsync: vi.fn(async () => Promise.resolve()),
  };
});

describe("SyncCoordinator - Container-Based Discovery", () => {
  let syncCoordinator: SyncCoordinator;
  let canvasService: CanvasService;
  let validation: ValidationService;
  let annotationStore: AnnotationStore;
  let mockDependencies: SyncCoordinatorDependencies;
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;

    validation = new ValidationService();
    annotationStore = new AnnotationStore();
    canvasService = new CanvasService(annotationStore);

    // Create mock element nodes for annotations
    const element1 = new MockFrameNode("element-1", "Element 1");
    const element2 = new MockFrameNode("element-2", "Element 2");
    const element3 = new MockFrameNode("element-3", "Element 3");
    mockFigma.addNode(element1);
    mockFigma.addNode(element2);
    mockFigma.addNode(element3);

    mockFigma.figma.getNodeByIdAsync = vi.fn(async (id: string) => {
      await Promise.resolve(); // Satisfy async requirement
      if (id === "element-1") return element1;
      if (id === "element-2") return element2;
      if (id === "element-3") return element3;
      return mockFigma.getNode(id) || null;
    });

    mockDependencies = {
      getAllAnnotations: vi.fn(() => annotationStore.getAll()),
      addAnnotation: vi.fn(async (ann: Annotation) => {
        await Promise.resolve();
        return annotationStore.add(ann);
      }),
      updateAnnotation: vi.fn(async (ann: Annotation) => {
        await Promise.resolve();
        return annotationStore.update(ann.id, ann);
      }),
      scheduleSync: vi.fn(),
    };

    syncCoordinator = new SyncCoordinator(
      canvasService,
      validation,
      mockDependencies
    );
  });

  // ==========================================================================
  // Container Discovery Tests
  // ==========================================================================

  describe("Container-based table discovery", () => {
    it("should discover tables from containers", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";

      // Create container with tables
      const container = canvasService.createAnnotationContainer(frameId);
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );
      const table3 = new MockFrameNode(
        "table-3",
        "Annotation Table 3 - frame-123"
      );

      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);
      tableColumn.appendChild(table3);

      mockFigma.figma.currentPage.appendChild(container as unknown as MockNode);

      // Test via checkCanvasSync which uses container-based discovery
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId,
        elementId: "element-1",
      });
      const annotation2 = createMobileAnnotation({
        id: 2,
        frameId,
        elementId: "element-2",
      });
      const annotation3 = createMobileAnnotation({
        id: 3,
        frameId,
        elementId: "element-3",
      });

      await annotationStore.add(annotation1);
      await annotationStore.add(annotation2);
      await annotationStore.add(annotation3);

      // Store metadata on tables
      await canvasService.storeTableMetadata(
        table1 as unknown as FrameNode,
        frameId,
        1,
        1,
        Date.now(),
        "element-1"
      );
      await canvasService.storeTableMetadata(
        table2 as unknown as FrameNode,
        frameId,
        2,
        1,
        Date.now(),
        "element-2"
      );
      await canvasService.storeTableMetadata(
        table3 as unknown as FrameNode,
        frameId,
        3,
        1,
        Date.now(),
        "element-3"
      );

      // Mock parseAnnotationFromTable
      vi.spyOn(canvasService, "parseAnnotationFromTable").mockImplementation(
        async (table: FrameNode): Promise<Annotation | null> => {
          await Promise.resolve();
          const name = table.name;
          if (name.includes("Annotation Table 1")) return annotation1;
          if (name.includes("Annotation Table 2")) return annotation2;
          if (name.includes("Annotation Table 3")) return annotation3;
          return null;
        }
      );

      const annotationsWithTables = await syncCoordinator.checkCanvasSync();

      expect(annotationsWithTables.length).toBeGreaterThanOrEqual(3);
      expect(annotationsWithTables).toContain(1);
      expect(annotationsWithTables).toContain(2);
      expect(annotationsWithTables).toContain(3);

      consoleMock.restore();
    });

    it("should handle empty container gracefully", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-empty";

      // Create empty container
      const container = canvasService.createAnnotationContainer(frameId);
      mockFigma.figma.currentPage.appendChild(container as unknown as MockNode);

      // checkCanvasSync should not fail
      const annotationsWithTables = await syncCoordinator.checkCanvasSync();
      expect(Array.isArray(annotationsWithTables)).toBe(true);

      consoleMock.restore();
    });
  });

  describe("Table discovery optimization", () => {
    it("should discover tables from containers via checkCanvasSync", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";

      // Create container with tables
      const container = canvasService.createAnnotationContainer(frameId);
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );

      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);
      mockFigma.figma.currentPage.appendChild(container as unknown as MockNode);

      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId,
        elementId: "element-1",
      });
      const annotation2 = createMobileAnnotation({
        id: 2,
        frameId,
        elementId: "element-2",
      });

      await annotationStore.add(annotation1);
      await annotationStore.add(annotation2);

      await canvasService.storeTableMetadata(
        table1 as unknown as FrameNode,
        frameId,
        1,
        1,
        Date.now(),
        "element-1"
      );
      await canvasService.storeTableMetadata(
        table2 as unknown as FrameNode,
        frameId,
        2,
        1,
        Date.now(),
        "element-2"
      );

      vi.spyOn(canvasService, "parseAnnotationFromTable").mockImplementation(
        async (table: FrameNode): Promise<Annotation | null> => {
          await Promise.resolve(); // Satisfy async requirement
          const name = table.name;
          if (name.includes("Annotation Table 1")) return annotation1;
          if (name.includes("Annotation Table 2")) return annotation2;
          return null;
        }
      );

      const annotationsWithTables = await syncCoordinator.checkCanvasSync();

      expect(annotationsWithTables.length).toBeGreaterThanOrEqual(2);
      expect(annotationsWithTables).toContain(1);
      expect(annotationsWithTables).toContain(2);

      consoleMock.restore();
    });

    it("should fall back to page scan for legacy tables", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-456";

      // Create legacy table (not in container)
      const legacyTable = new MockFrameNode(
        "legacy-table",
        "Annotation Table 1 - frame-456"
      );
      mockFigma.figma.currentPage.appendChild(legacyTable);

      const annotation = createMobileAnnotation({
        id: 1,
        frameId,
        elementId: "element-1",
      });
      await annotationStore.add(annotation);

      await canvasService.storeTableMetadata(
        legacyTable as unknown as FrameNode,
        frameId,
        1,
        1,
        Date.now(),
        "element-1"
      );

      vi.spyOn(canvasService, "parseAnnotationFromTable").mockImplementation(
        async (): Promise<Annotation | null> => {
          await Promise.resolve(); // Satisfy async requirement
          return annotation;
        }
      );

      const annotationsWithTables = await syncCoordinator.checkCanvasSync();

      expect(annotationsWithTables).toContain(1);

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Sync Operations Tests
  // ==========================================================================

  describe("checkCanvasSync with containers", () => {
    it("should extract annotation IDs from container children", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";

      // Create annotations
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId,
        elementId: "element-1",
      });
      const annotation2 = createMobileAnnotation({
        id: 2,
        frameId,
        elementId: "element-2",
      });
      await annotationStore.add(annotation1);
      await annotationStore.add(annotation2);

      // Create container with tables
      const container = canvasService.createAnnotationContainer(frameId);
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );

      // Store metadata on tables
      await canvasService.storeTableMetadata(
        table1 as unknown as FrameNode,
        frameId,
        1,
        1,
        Date.now(),
        "element-1"
      );
      await canvasService.storeTableMetadata(
        table2 as unknown as FrameNode,
        frameId,
        2,
        1,
        Date.now(),
        "element-2"
      );

      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);
      mockFigma.figma.currentPage.appendChild(container as unknown as MockNode);

      // Mock parseAnnotationFromTable to return annotations
      vi.spyOn(canvasService, "parseAnnotationFromTable").mockImplementation(
        async (table: FrameNode): Promise<Annotation | null> => {
          await Promise.resolve(); // Satisfy async requirement
          const name = table.name;
          if (name.includes("Annotation Table 1")) {
            return annotation1;
          }
          if (name.includes("Annotation Table 2")) {
            return annotation2;
          }
          return null;
        }
      );

      const annotationsWithTables = await syncCoordinator.checkCanvasSync();

      expect(annotationsWithTables).toContain(1);
      expect(annotationsWithTables).toContain(2);

      consoleMock.restore();
    });

    it("should work with mixed container and legacy tables", async () => {
      const consoleMock = mockConsole();
      const frameId1 = "frame-123";
      const frameId2 = "frame-456";

      // Create annotations
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: frameId1,
        elementId: "element-1",
      });
      const annotation2 = createMobileAnnotation({
        id: 2,
        frameId: frameId2,
        elementId: "element-2",
      });
      await annotationStore.add(annotation1);
      await annotationStore.add(annotation2);

      // Create container with table
      const container = canvasService.createAnnotationContainer(frameId1);
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      const containerTable = new MockFrameNode(
        "container-table",
        "Annotation Table 1 - frame-123"
      );
      await canvasService.storeTableMetadata(
        containerTable as unknown as FrameNode,
        frameId1,
        1,
        1,
        Date.now(),
        "element-1"
      );
      tableColumn.appendChild(containerTable);
      mockFigma.figma.currentPage.appendChild(container as unknown as MockNode);

      // Create legacy table
      const legacyTable = new MockFrameNode(
        "legacy-table",
        "Annotation Table 2 - frame-456"
      );
      await canvasService.storeTableMetadata(
        legacyTable as unknown as FrameNode,
        frameId2,
        2,
        1,
        Date.now(),
        "element-2"
      );
      mockFigma.figma.currentPage.appendChild(legacyTable);

      // Mock parseAnnotationFromTable
      vi.spyOn(canvasService, "parseAnnotationFromTable").mockImplementation(
        async (table: FrameNode): Promise<Annotation | null> => {
          await Promise.resolve(); // Satisfy async requirement
          const name = table.name;
          if (name.includes("Annotation Table 1")) {
            return annotation1;
          }
          if (name.includes("Annotation Table 2")) {
            return annotation2;
          }
          return null;
        }
      );

      const annotationsWithTables = await syncCoordinator.checkCanvasSync();

      expect(annotationsWithTables).toContain(1);
      expect(annotationsWithTables).toContain(2);

      consoleMock.restore();
    });
  });
});
