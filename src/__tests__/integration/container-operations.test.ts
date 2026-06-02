// ============================================================================
// CONTAINER OPERATIONS INTEGRATION TESTS - Full Workflows
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CanvasService } from "../../services/canvas";
import { AnnotationStore } from "../../services/annotation-store";
import { createMockFigma, MockFrameNode, MockNode } from "../mocks/figma";
// FrameNode and GroupNode are global types from Figma API
import { createMobileAnnotation } from "../fixtures/annotations";
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

describe("Container Operations - Integration Tests", () => {
  let canvasService: CanvasService;
  let annotationStore: AnnotationStore;
  let mockFigma: ReturnType<typeof createMockFigma>;
  let testFrame: MockFrameNode;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
    annotationStore = new AnnotationStore();
    canvasService = new CanvasService(annotationStore);

    // Create a test frame
    testFrame = new MockFrameNode("frame-123", "Test Frame");
    testFrame.x = 100;
    testFrame.y = 200;
    testFrame.width = 300;
    testFrame.height = 400;
    mockFigma.addNode(testFrame);

    // Create mock element nodes for annotations
    const element1 = new MockFrameNode("element-1", "Element 1");
    const element2 = new MockFrameNode("element-2", "Element 2");
    mockFigma.addNode(element1);
    mockFigma.addNode(element2);

    mockFigma.figma.getNodeByIdAsync = vi.fn(async (id: string) => {
      await Promise.resolve(); // Satisfy async requirement
      if (id === "frame-123") return testFrame;
      if (id === "element-1") return element1;
      if (id === "element-2") return element2;
      return mockFigma.getNode(id) || null;
    });
  });

  afterEach(() => {
    mockFigma.reset();
  });

  // ==========================================================================
  // Insert Flow Tests
  // ==========================================================================

  describe("Insert Flow", () => {
    it("should create container if none exists", async () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
        elementId: "element-1",
      });
      await annotationStore.add(annotation);

      const container = await canvasService.getOrCreateContainer("frame-123");

      expect(container).toBeDefined();
      expect(container.name).toBe("Annotation Container - frame-123");
      expect(container.layoutMode).toBe("HORIZONTAL");
      expect(mockFigma.figma.currentPage.children).toContain(container);

      consoleMock.restore();
    });

    it("should reuse existing container", async () => {
      const consoleMock = mockConsole();
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
        elementId: "element-1",
      });
      await annotationStore.add(annotation1);

      // Create container first
      const container1 = await canvasService.getOrCreateContainer("frame-123");
      // Container is already appended by getOrCreateContainer

      // Get or create again - should reuse
      const container2 = await canvasService.getOrCreateContainer("frame-123");

      expect(container2.id).toBe(container1.id);
      // Verify only one container exists on the page
      const containers = mockFigma.figma.currentPage.children.filter(
        (c) => c.name === "Annotation Container - frame-123"
      );
      expect(containers).toHaveLength(1);
      const container = containers[0];
      expect(container).toBeDefined();
      expect(container?.id).toBe(container1.id);

      consoleMock.restore();
    });

    it("should insert badges into badge column in sorted order", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");
      const badgeColumn = container.children.find(
        (c) => c.name === "Badge Column"
      ) as unknown as MockFrameNode;

      // Create badges in non-sequential order
      const badge3 = new MockFrameNode(
        "badge-3",
        "Annotation Badge 3 - frame-123"
      );
      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge5 = new MockFrameNode(
        "badge-5",
        "Annotation Badge 5 - frame-123"
      );

      canvasService.insertBadgeIntoContainer(
        badge3 as unknown as FrameNode,
        container,
        3
      );
      canvasService.insertBadgeIntoContainer(
        badge1 as unknown as FrameNode,
        container,
        1
      );
      canvasService.insertBadgeIntoContainer(
        badge5 as unknown as FrameNode,
        container,
        5
      );

      expect(badgeColumn.children).toHaveLength(3);
      const firstBadgeChild = badgeColumn.children[0];
      const secondBadgeChild = badgeColumn.children[1];
      const thirdBadgeChild = badgeColumn.children[2];
      expect(firstBadgeChild).toBeDefined();
      expect(secondBadgeChild).toBeDefined();
      expect(thirdBadgeChild).toBeDefined();
      expect(firstBadgeChild?.name).toBe("Annotation Badge 1 - frame-123");
      expect(secondBadgeChild?.name).toBe("Annotation Badge 3 - frame-123");
      expect(thirdBadgeChild?.name).toBe("Annotation Badge 5 - frame-123");

      consoleMock.restore();
    });

    it("should insert tables into table column in sorted order", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      // Create tables in non-sequential order
      const table4 = new MockFrameNode(
        "table-4",
        "Annotation Table 4 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );
      const table6 = new MockFrameNode(
        "table-6",
        "Annotation Table 6 - frame-123"
      );

      canvasService.insertTableIntoContainer(
        table4 as unknown as FrameNode,
        container,
        4
      );
      canvasService.insertTableIntoContainer(
        table2 as unknown as FrameNode,
        container,
        2
      );
      canvasService.insertTableIntoContainer(
        table6 as unknown as FrameNode,
        container,
        6
      );

      expect(tableColumn.children).toHaveLength(3);
      const firstTableChild = tableColumn.children[0];
      const secondTableChild = tableColumn.children[1];
      const thirdTableChild = tableColumn.children[2];
      expect(firstTableChild).toBeDefined();
      expect(secondTableChild).toBeDefined();
      expect(thirdTableChild).toBeDefined();
      expect(firstTableChild?.name).toBe("Annotation Table 2 - frame-123");
      expect(secondTableChild?.name).toBe("Annotation Table 4 - frame-123");
      expect(thirdTableChild?.name).toBe("Annotation Table 6 - frame-123");

      consoleMock.restore();
    });

    it("should position container relative to frame", async () => {
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");

      await canvasService.positionContainerRelativeToFrame(
        container,
        "frame-123"
      );

      expect(container.x).toBe(460); // 100 + 300 + 60
      expect(container.y).toBe(200); // frame.y

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Update Flow Tests
  // ==========================================================================

  describe("Update Flow", () => {
    it("should update container position when frame moves significantly", async () => {
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");
      container.x = 460;
      container.y = 200;

      // Move frame significantly (>10px)
      testFrame.x = 150; // 50px difference
      await canvasService.positionContainerRelativeToFrame(
        container,
        "frame-123"
      );

      expect(container.x).toBe(510); // 150 + 300 + 60

      consoleMock.restore();
    });

    it("should not update container position for small frame movements", async () => {
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");
      container.x = 460;
      container.y = 200;

      // Small movement (<10px)
      testFrame.x = 105; // Only 5px difference
      await canvasService.positionContainerRelativeToFrame(
        container,
        "frame-123"
      );

      expect(container.x).toBe(460); // Should remain unchanged

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Delete Flow Tests
  // ==========================================================================

  describe("Delete Flow", () => {
    it("should remove badge and table from container when deleting annotation", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode(
        "container-1",
        "Annotation Container - frame-123"
      );
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      // Add badges and tables
      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge2 = new MockFrameNode(
        "badge-2",
        "Annotation Badge 2 - frame-123"
      );
      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );

      badgeColumn.appendChild(badge1);
      badgeColumn.appendChild(badge2);
      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);

      mockFigma.figma.currentPage.appendChild(container);

      // Delete annotation 1
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
      });
      canvasService.deleteAnnotationArtifacts(annotation1);

      // Badge and table for annotation 1 should be marked as removed
      expect(badge1.removed).toBe(true);
      expect(table1.removed).toBe(true);
      // Other artifacts should remain
      expect(badge2.removed).toBe(false);
      expect(table2.removed).toBe(false);

      consoleMock.restore();
    });

    it("should keep container when other annotations exist", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode(
        "container-1",
        "Annotation Container - frame-123"
      );
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge2 = new MockFrameNode(
        "badge-2",
        "Annotation Badge 2 - frame-123"
      );
      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );

      badgeColumn.appendChild(badge1);
      badgeColumn.appendChild(badge2);
      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);

      mockFigma.figma.currentPage.appendChild(container);

      // Delete annotation 1
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
      });
      canvasService.deleteAnnotationArtifacts(annotation1);

      // Container should still exist
      expect(mockFigma.figma.currentPage.children).toContain(container);
      expect(container.removed).toBe(false);

      consoleMock.restore();
    });

    it("should delete container when last annotation is removed", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode(
        "container-1",
        "Annotation Container - frame-123"
      );
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );

      badgeColumn.appendChild(badge1);
      tableColumn.appendChild(table1);

      mockFigma.figma.currentPage.appendChild(container);

      // Delete last annotation
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
      });
      canvasService.deleteAnnotationArtifacts(annotation1);

      // Badge and table should be removed
      expect(badge1.removed).toBe(true);
      expect(table1.removed).toBe(true);
      // Container should be removed (deleteAnnotationArtifacts checks if columns are empty)
      expect(container.removed).toBe(true);

      consoleMock.restore();
    });

    it("should delete container when all annotations for frame are removed", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode(
        "container-1",
        "Annotation Container - frame-123"
      );
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge2 = new MockFrameNode(
        "badge-2",
        "Annotation Badge 2 - frame-123"
      );
      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );

      badgeColumn.appendChild(badge1);
      badgeColumn.appendChild(badge2);
      tableColumn.appendChild(table1);
      tableColumn.appendChild(table2);

      mockFigma.figma.currentPage.appendChild(container);

      // Delete all annotations
      const annotation1 = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
      });
      const annotation2 = createMobileAnnotation({
        id: 2,
        frameId: "frame-123",
      });

      canvasService.deleteAnnotationArtifacts(annotation1);
      // After first deletion, container should still exist
      expect(container.removed).toBe(false);

      canvasService.deleteAnnotationArtifacts(annotation2);
      // After second deletion, container should be removed
      expect(container.removed).toBe(true);

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Edge Cases Tests
  // ==========================================================================

  describe("Edge Cases", () => {
    it("should recreate container when manually deleted", async () => {
      const consoleMock = mockConsole();
      const annotation = createMobileAnnotation({
        id: 1,
        frameId: "frame-123",
        elementId: "element-1",
      });
      await annotationStore.add(annotation);

      // Create container
      const container1 = await canvasService.getOrCreateContainer("frame-123");
      mockFigma.figma.currentPage.appendChild(
        container1 as unknown as MockNode
      );

      // Manually delete container
      container1.remove();
      const index = mockFigma.figma.currentPage.children.indexOf(
        container1 as unknown as MockNode
      );
      if (index > -1) {
        mockFigma.figma.currentPage.children.splice(index, 1);
      }

      // Get or create again - should recreate
      const container2 = await canvasService.getOrCreateContainer("frame-123");

      expect(container2).toBeDefined();
      expect(container2.id).not.toBe(container1.id);
      expect(container2.name).toBe("Annotation Container - frame-123");

      consoleMock.restore();
    });

    it("should handle multiple annotations inserted in non-sequential order", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const container = canvasService.createAnnotationContainer("frame-123");
      const badgeColumn = container.children.find(
        (c) => c.name === "Badge Column"
      ) as unknown as MockFrameNode;
      const tableColumn = container.children.find(
        (c) => c.name === "Table Column"
      ) as unknown as MockFrameNode;

      // Insert in non-sequential order: 5, 1, 3, 2, 4
      const badges = [5, 1, 3, 2, 4].map((id) => ({
        badge: new MockFrameNode(
          `badge-${id}`,
          `Annotation Badge ${id} - frame-123`
        ),
        id,
      }));
      const tables = [5, 1, 3, 2, 4].map((id) => ({
        table: new MockFrameNode(
          `table-${id}`,
          `Annotation Table ${id} - frame-123`
        ),
        id,
      }));

      badges.forEach(({ badge, id }) => {
        canvasService.insertBadgeIntoContainer(
          badge as unknown as FrameNode,
          container,
          id
        );
      });
      tables.forEach(({ table, id }) => {
        canvasService.insertTableIntoContainer(
          table as unknown as FrameNode,
          container,
          id
        );
      });

      // Verify sorted order
      expect(badgeColumn.children.map((c) => c.name)).toEqual([
        "Annotation Badge 1 - frame-123",
        "Annotation Badge 2 - frame-123",
        "Annotation Badge 3 - frame-123",
        "Annotation Badge 4 - frame-123",
        "Annotation Badge 5 - frame-123",
      ]);

      expect(tableColumn.children.map((c) => c.name)).toEqual([
        "Annotation Table 1 - frame-123",
        "Annotation Table 2 - frame-123",
        "Annotation Table 3 - frame-123",
        "Annotation Table 4 - frame-123",
        "Annotation Table 5 - frame-123",
      ]);

      consoleMock.restore();
    });
  });
});
