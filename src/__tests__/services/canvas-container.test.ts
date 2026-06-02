// ============================================================================
// CANVAS CONTAINER TESTS - Container Management and Operations
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CanvasService } from "../../services/canvas";
import { createMockFigma, MockFrameNode, MockNode } from "../mocks/figma";
import { ContainerMetadata } from "../../types";
import { mockConsole } from "../utils/test-helpers";
// FrameNode and GroupNode are global types from Figma API

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
  };
});

describe("CanvasService - Container Management", () => {
  let canvasService: CanvasService;
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
    canvasService = new CanvasService();
  });

  afterEach(() => {
    mockFigma.reset();
  });

  // ==========================================================================
  // Container Creation Tests
  // ==========================================================================

  describe("createAnnotationContainer", () => {
    it("should create container with correct structure", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const frameId = "frame-123";

      const container = canvasService.createAnnotationContainer(frameId);

      // Verify container properties
      expect(container.name).toBe("Annotation Container - frame-123");
      expect(container.layoutMode).toBe("HORIZONTAL");
      expect(container.primaryAxisSizingMode).toBe("AUTO");
      expect(container.counterAxisSizingMode).toBe("AUTO");
      expect(container.itemSpacing).toBe(8);
      expect(container.fills).toEqual([]);

      // Verify container has two children (badge column and table column)
      expect(container.children).toHaveLength(2);

      // Verify badge column
      const badgeColumn = container.children.find(
        (child) => child.name === "Badge Column"
      ) as unknown as MockFrameNode;
      expect(badgeColumn).toBeDefined();
      expect(badgeColumn.layoutMode).toBe("VERTICAL");
      expect(badgeColumn.itemSpacing).toBe(8);
      expect(badgeColumn.primaryAxisSizingMode).toBe("AUTO");
      expect(badgeColumn.counterAxisSizingMode).toBe("AUTO");

      // Verify table column
      const tableColumn = container.children.find(
        (child) => child.name === "Table Column"
      ) as unknown as MockFrameNode;
      expect(tableColumn).toBeDefined();
      expect(tableColumn.layoutMode).toBe("VERTICAL");
      expect(tableColumn.itemSpacing).toBe(50);
      expect(tableColumn.primaryAxisSizingMode).toBe("AUTO");
      expect(tableColumn.counterAxisSizingMode).toBe("AUTO");

      consoleMock.restore();
    });

    it("should store container metadata", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const frameId = "frame-123";
      const timestamp = Date.now();

      const container = canvasService.createAnnotationContainer(frameId);

      const metadata = canvasService.readContainerMetadata(
        container as unknown as FrameNode
      );
      expect(metadata).not.toBeNull();
      expect(metadata?.sourceFrameId).toBe(frameId);
      expect(metadata?.version).toBe(1);
      expect(metadata?.timestamp).toBeGreaterThanOrEqual(timestamp);

      consoleMock.restore();
    });
  });

  describe("getOrCreateContainer", () => {
    it("should find existing container", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";

      // Create container first
      const existingContainer =
        canvasService.createAnnotationContainer(frameId);
      mockFigma.figma.currentPage.appendChild(
        existingContainer as unknown as MockNode
      );

      // Try to get or create - should find existing
      const container = await canvasService.getOrCreateContainer(frameId);

      expect(container.id).toBe(existingContainer.id);
      expect(container.name).toBe("Annotation Container - frame-123");

      consoleMock.restore();
    });

    it("should create new container when none exists", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-456";

      // Create a mock frame for positioning
      const frame = new MockFrameNode(frameId, "Test Frame");
      frame.x = 100;
      frame.y = 200;
      frame.width = 300;
      frame.height = 400;
      mockFigma.addNode(frame);
      mockFigma.figma.getNodeByIdAsync = vi.fn(async (id: string) => {
        await Promise.resolve(); // Satisfy async requirement
        if (id === frameId) return frame;
        return null;
      });

      const container = await canvasService.getOrCreateContainer(frameId);

      expect(container).toBeDefined();
      expect(container.name).toBe("Annotation Container - frame-456");
      expect(mockFigma.figma.currentPage.children).toContain(container);

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Container Metadata Tests
  // ==========================================================================

  describe("storeContainerMetadata", () => {
    it("should store metadata correctly", async () => {
      await Promise.resolve();
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const frameId = "frame-123";
      const version = 1;
      const timestamp = 1234567890;

      canvasService.storeContainerMetadata(
        container as unknown as FrameNode,
        frameId,
        version,
        timestamp
      );

      const metadataStr = container.getPluginData(
        "voice_over_annotations_containerMetadata"
      );
      expect(metadataStr).not.toBe("");
      const metadata = JSON.parse(metadataStr) as ContainerMetadata;
      expect(metadata.sourceFrameId).toBe(frameId);
      expect(metadata.version).toBe(version);
      expect(metadata.timestamp).toBe(timestamp);

      consoleMock.restore();
    });
  });

  describe("readContainerMetadata", () => {
    it("should read metadata correctly", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const metadata: ContainerMetadata = {
        sourceFrameId: "frame-123",
        version: 1,
        timestamp: 1234567890,
      };

      container.setPluginData(
        "voice_over_annotations_containerMetadata",
        JSON.stringify(metadata)
      );

      const readMetadata = canvasService.readContainerMetadata(
        container as unknown as FrameNode
      );
      expect(readMetadata).toEqual(metadata);

      consoleMock.restore();
    });

    it("should return null for missing metadata", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");

      const metadata = canvasService.readContainerMetadata(
        container as unknown as FrameNode
      );
      expect(metadata).toBeNull();

      consoleMock.restore();
    });

    it("should handle legacy containers without version", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const legacyMetadata = {
        sourceFrameId: "frame-123",
        timestamp: 1234567890,
        // No version field
      };

      container.setPluginData(
        "voice_over_annotations_containerMetadata",
        JSON.stringify(legacyMetadata)
      );

      const readMetadata = canvasService.readContainerMetadata(
        container as unknown as FrameNode
      );
      expect(readMetadata).not.toBeNull();
      expect(readMetadata?.version).toBe(1); // Should default to 1

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Container Positioning Tests
  // ==========================================================================

  describe("positionContainerRelativeToFrame", () => {
    it("should position container at frame right edge + 60px", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";
      const frame = new MockFrameNode(frameId, "Test Frame");
      frame.x = 100;
      frame.y = 200;
      frame.width = 300;
      frame.height = 400;
      mockFigma.addNode(frame);
      mockFigma.figma.getNodeByIdAsync = vi.fn(async (id: string) => {
        await Promise.resolve(); // Satisfy async requirement
        if (id === frameId) return frame;
        return null;
      });

      const container = new MockFrameNode("container-1", "Test Container");
      await canvasService.positionContainerRelativeToFrame(
        container as unknown as FrameNode,
        frameId
      );

      expect(container.x).toBe(460); // 100 + 300 + 60
      expect(container.y).toBe(200); // frame.y

      consoleMock.restore();
    });

    it("should only reposition if frame moved significantly (>10px)", async () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";
      const frame = new MockFrameNode(frameId, "Test Frame");
      frame.x = 100;
      frame.y = 200;
      frame.width = 300;
      frame.height = 400;
      mockFigma.addNode(frame);
      mockFigma.figma.getNodeByIdAsync = vi.fn(async (id: string) => {
        await Promise.resolve(); // Satisfy async requirement
        if (id === frameId) return frame;
        return null;
      });

      const container = new MockFrameNode("container-1", "Test Container");
      container.x = 460; // Already at correct position
      container.y = 200;

      // Small movement (<10px) - should not reposition
      frame.x = 105; // Only 5px difference
      await canvasService.positionContainerRelativeToFrame(
        container as unknown as FrameNode,
        frameId
      );

      expect(container.x).toBe(460); // Should remain unchanged

      // Large movement (>10px) - should reposition
      frame.x = 120; // 20px difference
      await canvasService.positionContainerRelativeToFrame(
        container as unknown as FrameNode,
        frameId
      );

      expect(container.x).toBe(480); // 120 + 300 + 60

      consoleMock.restore();
    });

    it("should handle missing frame gracefully", async () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      mockFigma.figma.getNodeByIdAsync = vi.fn(async () => {
        await Promise.resolve();
        return null;
      });

      await canvasService.positionContainerRelativeToFrame(
        container as unknown as FrameNode,
        "non-existent"
      );

      // Should not throw, container position unchanged
      expect(container.x).toBe(0);
      expect(container.y).toBe(0);

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Sorted Insertion Tests
  // ==========================================================================

  describe("insertBadgeIntoContainer", () => {
    it("should insert badge at correct sorted position", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      // Add existing badges with IDs 1 and 5
      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge5 = new MockFrameNode(
        "badge-5",
        "Annotation Badge 5 - frame-123"
      );
      badgeColumn.appendChild(badge1);
      badgeColumn.appendChild(badge5);

      // Insert badge with ID 3 (should go between 1 and 5)
      const badge3 = new MockFrameNode(
        "badge-3",
        "Annotation Badge 3 - frame-123"
      );
      canvasService.insertBadgeIntoContainer(
        badge3 as unknown as FrameNode,
        container as unknown as FrameNode,
        3
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

    it("should append to end when ID is highest", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      badgeColumn.appendChild(badge1);

      const badge10 = new MockFrameNode(
        "badge-10",
        "Annotation Badge 10 - frame-123"
      );
      canvasService.insertBadgeIntoContainer(
        badge10 as unknown as FrameNode,
        container as unknown as FrameNode,
        10
      );

      expect(badgeColumn.children).toHaveLength(2);
      const secondBadgeChild = badgeColumn.children[1];
      expect(secondBadgeChild).toBeDefined();
      expect(secondBadgeChild?.name).toBe("Annotation Badge 10 - frame-123");

      consoleMock.restore();
    });

    it("should insert at beginning when ID is lowest", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge5 = new MockFrameNode(
        "badge-5",
        "Annotation Badge 5 - frame-123"
      );
      badgeColumn.appendChild(badge5);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      canvasService.insertBadgeIntoContainer(
        badge1 as unknown as FrameNode,
        container as unknown as FrameNode,
        1
      );

      expect(badgeColumn.children).toHaveLength(2);
      const firstBadgeChild = badgeColumn.children[0];
      const secondBadgeChild = badgeColumn.children[1];
      expect(firstBadgeChild).toBeDefined();
      expect(secondBadgeChild).toBeDefined();
      expect(firstBadgeChild?.name).toBe("Annotation Badge 1 - frame-123");
      expect(secondBadgeChild?.name).toBe("Annotation Badge 5 - frame-123");

      consoleMock.restore();
    });

    it("should insert in middle when ID is between existing", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      const badge1 = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const badge3 = new MockFrameNode(
        "badge-3",
        "Annotation Badge 3 - frame-123"
      );
      const badge7 = new MockFrameNode(
        "badge-7",
        "Annotation Badge 7 - frame-123"
      );
      badgeColumn.appendChild(badge1);
      badgeColumn.appendChild(badge3);
      badgeColumn.appendChild(badge7);

      const badge5 = new MockFrameNode(
        "badge-5",
        "Annotation Badge 5 - frame-123"
      );
      canvasService.insertBadgeIntoContainer(
        badge5 as unknown as FrameNode,
        container as unknown as FrameNode,
        5
      );

      expect(badgeColumn.children).toHaveLength(4);
      const firstBadgeChild = badgeColumn.children[0];
      const secondBadgeChild = badgeColumn.children[1];
      const thirdBadgeChild = badgeColumn.children[2];
      const fourthBadgeChild = badgeColumn.children[3];
      expect(firstBadgeChild).toBeDefined();
      expect(secondBadgeChild).toBeDefined();
      expect(thirdBadgeChild).toBeDefined();
      expect(fourthBadgeChild).toBeDefined();
      expect(firstBadgeChild?.name).toBe("Annotation Badge 1 - frame-123");
      expect(secondBadgeChild?.name).toBe("Annotation Badge 3 - frame-123");
      expect(thirdBadgeChild?.name).toBe("Annotation Badge 5 - frame-123");
      expect(fourthBadgeChild?.name).toBe("Annotation Badge 7 - frame-123");

      consoleMock.restore();
    });
  });

  describe("insertTableIntoContainer", () => {
    it("should insert table at correct sorted position", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      // Add existing tables with IDs 2 and 6
      const table2 = new MockFrameNode(
        "table-2",
        "Annotation Table 2 - frame-123"
      );
      const table6 = new MockFrameNode(
        "table-6",
        "Annotation Table 6 - frame-123"
      );
      tableColumn.appendChild(table2);
      tableColumn.appendChild(table6);

      // Insert table with ID 4 (should go between 2 and 6)
      const table4 = new MockFrameNode(
        "table-4",
        "Annotation Table 4 - frame-123"
      );
      canvasService.insertTableIntoContainer(
        table4 as unknown as FrameNode,
        container as unknown as FrameNode,
        4
      );

      expect(tableColumn.children).toHaveLength(3);
      const firstTableChild = tableColumn.children[0];
      const secondTableChild = tableColumn.children[1];
      const thirdTableChild = tableColumn.children[2];
      expect(firstTableChild).toBeDefined();
      expect(secondTableChild).toBeDefined();
      expect(thirdTableChild).toBeDefined();
      expect(firstTableChild?.name).toBe(
        "Annotation Table 2 - frame-123"
      );
      expect(secondTableChild?.name).toBe(
        "Annotation Table 4 - frame-123"
      );
      expect(thirdTableChild?.name).toBe(
        "Annotation Table 6 - frame-123"
      );

      consoleMock.restore();
    });

    it("should maintain annotation ID order", () => {
      const consoleMock = mockConsole();
      const container = new MockFrameNode("container-1", "Test Container");
      const badgeColumn = new MockFrameNode("badge-col", "Badge Column");
      const tableColumn = new MockFrameNode("table-col", "Table Column");
      container.appendChild(badgeColumn);
      container.appendChild(tableColumn);

      // Insert tables in non-sequential order
      const table5 = new MockFrameNode(
        "table-5",
        "Annotation Table 5 - frame-123"
      );
      const table1 = new MockFrameNode(
        "table-1",
        "Annotation Table 1 - frame-123"
      );
      const table3 = new MockFrameNode(
        "table-3",
        "Annotation Table 3 - frame-123"
      );

      canvasService.insertTableIntoContainer(
        table5 as unknown as FrameNode,
        container as unknown as FrameNode,
        5
      );
      canvasService.insertTableIntoContainer(
        table1 as unknown as FrameNode,
        container as unknown as FrameNode,
        1
      );
      canvasService.insertTableIntoContainer(
        table3 as unknown as FrameNode,
        container as unknown as FrameNode,
        3
      );

      expect(tableColumn.children).toHaveLength(3);
      const firstTableChild = tableColumn.children[0];
      const secondTableChild = tableColumn.children[1];
      const thirdTableChild = tableColumn.children[2];
      expect(firstTableChild).toBeDefined();
      expect(secondTableChild).toBeDefined();
      expect(thirdTableChild).toBeDefined();
      expect(firstTableChild?.name).toBe(
        "Annotation Table 1 - frame-123"
      );
      expect(secondTableChild?.name).toBe(
        "Annotation Table 3 - frame-123"
      );
      expect(thirdTableChild?.name).toBe(
        "Annotation Table 5 - frame-123"
      );

      consoleMock.restore();
    });
  });
});
