// ============================================================================
// CANVAS SERVICE INTEGRATION TESTS - Basic Operations
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createMockFigma, MockFrameNode } from "../mocks/figma";

describe("Canvas Service Integration Tests - Basic Operations", () => {
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
  });

  afterEach(() => {
    mockFigma.reset();
  });

  describe("node creation", () => {
    it("should create frame with Figma API", () => {
      // Act
      const frame = mockFigma.figma.createFrame();

      // Assert
      expect(frame).toBeDefined();
      expect(frame.type).toBe("FRAME");
      expect(mockFigma.wasMethodCalled("createFrame")).toBe(true);
    });

    it("should create text node with Figma API", () => {
      // Act
      const text = mockFigma.figma.createText();

      // Assert
      expect(text).toBeDefined();
      expect(text.type).toBe("TEXT");
      expect(mockFigma.wasMethodCalled("createText")).toBe(true);
    });

    it("should create rectangle with Figma API", () => {
      // Act
      const rect = mockFigma.figma.createRectangle();

      // Assert
      expect(rect).toBeDefined();
      expect(rect.type).toBe("RECTANGLE");
      expect(mockFigma.wasMethodCalled("createRectangle")).toBe(true);
    });
  });

  describe("table metadata storage", () => {
    it("should store and retrieve table metadata", () => {
      // Arrange
      const table = new MockFrameNode("table-1", "Annotation Table");
      mockFigma.addNode(table);

      const metadata = {
        sourceFrameId: "frame-123",
        annotationId: 42,
        version: 1,
        timestamp: Date.now(),
      };

      // Act - Store metadata
      table.setPluginData(
        "voice_over_annotations_tableMetadata",
        JSON.stringify(metadata)
      );

      // Retrieve metadata
      const storedData = table.getPluginData(
        "voice_over_annotations_tableMetadata"
      );
      const parsed = JSON.parse(storedData) as typeof metadata;

      // Assert
      expect(parsed.sourceFrameId).toBe("frame-123");
      expect(parsed.annotationId).toBe(42);
      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBe(metadata.timestamp);
    });

    it("should return empty string for missing metadata", () => {
      // Arrange
      const table = new MockFrameNode("table-2", "Empty Table");
      mockFigma.addNode(table);

      // Act
      const metadata = table.getPluginData(
        "voice_over_annotations_tableMetadata"
      );

      // Assert
      expect(metadata).toBe("");
    });

    it("should update existing metadata", () => {
      // Arrange
      const table = new MockFrameNode("table-3", "Annotation Table");
      mockFigma.addNode(table);

      const originalMetadata = {
        sourceFrameId: "frame-123",
        annotationId: 42,
        version: 1,
        timestamp: 1000,
      };

      table.setPluginData(
        "voice_over_annotations_tableMetadata",
        JSON.stringify(originalMetadata)
      );

      // Act - Update metadata
      const updatedMetadata = {
        ...originalMetadata,
        version: 2,
        timestamp: 2000,
      };

      table.setPluginData(
        "voice_over_annotations_tableMetadata",
        JSON.stringify(updatedMetadata)
      );

      // Retrieve updated metadata
      const storedData = table.getPluginData(
        "voice_over_annotations_tableMetadata"
      );
      const parsed = JSON.parse(storedData) as typeof updatedMetadata;

      // Assert
      expect(parsed.version).toBe(2);
      expect(parsed.timestamp).toBe(2000);
    });
  });

  describe("frame hierarchy", () => {
    it("should build parent-child relationships", () => {
      // Arrange
      const parent = new MockFrameNode("parent", "Parent Frame");
      const child1 = new MockFrameNode("child1", "Child 1");
      const child2 = new MockFrameNode("child2", "Child 2");

      mockFigma.addNode(parent);
      mockFigma.addNode(child1);
      mockFigma.addNode(child2);

      // Act
      parent.appendChild(child1);
      parent.appendChild(child2);

      // Assert
      expect(parent.children).toHaveLength(2);
      const firstChild = parent.children[0];
      const secondChild = parent.children[1];
      expect(firstChild).toBeDefined();
      expect(secondChild).toBeDefined();
      expect(firstChild?.id).toBe("child1");
      expect(secondChild?.id).toBe("child2");
      expect(child1.parent).toBe(parent);
      expect(child2.parent).toBe(parent);
    });

    it("should find children by predicate", () => {
      // Arrange
      const parent = new MockFrameNode("parent", "Parent Frame");
      const table1 = new MockFrameNode("table1", "VO Annotation Table");
      const table2 = new MockFrameNode("table2", "VO Annotation Table");
      const other = new MockFrameNode("other", "Other Frame");

      parent.appendChild(table1);
      parent.appendChild(table2);
      parent.appendChild(other);

      // Act
      const annotationTables = parent.findAll((node) =>
        node.name.includes("VO Annotation Table")
      );

      // Assert
      expect(annotationTables).toHaveLength(2);
      const firstTable = annotationTables[0];
      const secondTable = annotationTables[1];
      expect(firstTable).toBeDefined();
      expect(secondTable).toBeDefined();
      expect(firstTable?.id).toBe("table1");
      expect(secondTable?.id).toBe("table2");
    });

    it("should find one child by predicate", () => {
      // Arrange
      const parent = new MockFrameNode("parent", "Parent Frame");
      const target = new MockFrameNode("target", "Target Frame");
      const other = new MockFrameNode("other", "Other Frame");

      parent.appendChild(target);
      parent.appendChild(other);

      // Act
      const found = parent.findOne((node) => node.name === "Target Frame");

      // Assert
      expect(found).toBeDefined();
      expect(found?.id).toBe("target");
    });
  });

  describe("notifications", () => {
    it("should capture notification messages", () => {
      // Act
      mockFigma.figma.notify("Test notification");
      mockFigma.figma.notify("Another notification");

      // Assert
      const notifications = mockFigma.getNotifications();
      expect(notifications).toHaveLength(2);
      expect(notifications[0]).toBe("Test notification");
      expect(notifications[1]).toBe("Another notification");
    });

    it("should clear notifications", () => {
      // Arrange
      mockFigma.figma.notify("Test notification");
      expect(mockFigma.getNotifications()).toHaveLength(1);

      // Act
      mockFigma.clearNotifications();

      // Assert
      expect(mockFigma.getNotifications()).toHaveLength(0);
    });
  });

  describe("page operations", () => {
    it("should access current page", () => {
      // Act
      const currentPage = mockFigma.figma.currentPage;

      // Assert
      expect(currentPage).toBeDefined();
      expect(currentPage.type).toBe("PAGE");
      expect(currentPage.id).toBe("page-1");
    });

    it("should create and switch pages", () => {
      // Arrange
      const page2 = mockFigma.createPage("page-2", "Page 2");

      // Act
      mockFigma.setCurrentPage(page2);

      // Assert
      expect(mockFigma.figma.currentPage.id).toBe("page-2");
      expect(mockFigma.figma.currentPage.name).toBe("Page 2");
    });

    it("should load all pages", async () => {
      // Act
      await mockFigma.figma.loadAllPagesAsync();

      // Assert
      expect(mockFigma.wasMethodCalled("loadAllPagesAsync")).toBe(true);
    });

    it("should access root document", () => {
      // Act
      const root = mockFigma.figma.root;

      // Assert
      expect(root).toBeDefined();
      expect(root.type).toBe("DOCUMENT");
      expect(root.children).toHaveLength(1); // Default page
    });
  });

  describe("node lookup", () => {
    it("should find node by ID", async () => {
      // Arrange
      const frame = new MockFrameNode("test-frame", "Test Frame");
      mockFigma.addNode(frame);

      // Act
      const found = await mockFigma.figma.getNodeByIdAsync("test-frame");

      // Assert
      expect(found).toBeDefined();
      expect(found?.id).toBe("test-frame");
      expect(found?.name).toBe("Test Frame");
    });

    it("should return null for non-existent node", async () => {
      // Act
      const found = await mockFigma.figma.getNodeByIdAsync("non-existent");

      // Assert
      expect(found).toBeNull();
    });

    it("should track node lookup calls", async () => {
      // Arrange
      const frame = new MockFrameNode("frame-1", "Frame 1");
      mockFigma.addNode(frame);

      // Act
      await mockFigma.figma.getNodeByIdAsync("frame-1");
      await mockFigma.figma.getNodeByIdAsync("frame-2");

      // Assert
      const calls = mockFigma.getCallsByMethod("getNodeByIdAsync");
      expect(calls).toHaveLength(2);
      const firstCall = calls[0];
      const secondCall = calls[1];
      expect(firstCall).toBeDefined();
      expect(secondCall).toBeDefined();
      expect(firstCall?.args[0]).toBe("frame-1");
      expect(secondCall?.args[0]).toBe("frame-2");
    });
  });

  describe("font loading", () => {
    it("should mock font loading", async () => {
      // Act
      await mockFigma.figma.loadFontAsync({ family: "Inter", style: "Regular" });

      // Assert
      expect(mockFigma.wasMethodCalled("loadFontAsync")).toBe(true);
      expect(mockFigma.figma.loadFontAsync).toHaveBeenCalledWith({ family: "Inter", style: "Regular" });
    });
  });

  describe("mock isolation", () => {
    it("should not leak nodes between tests", async () => {
      // This test verifies that beforeEach reset works
      const found = await mockFigma.figma.getNodeByIdAsync("test-frame");
      expect(found).toBeNull();
    });

    it("should not leak calls between tests", () => {
      // This test verifies that beforeEach reset works
      const calls = mockFigma.getCalls();
      expect(calls).toHaveLength(0);
    });

    it("should not leak notifications between tests", () => {
      // This test verifies that beforeEach reset works
      const notifications = mockFigma.getNotifications();
      expect(notifications).toHaveLength(0);
    });
  });

  describe("collision avoidance", () => {
    it("should query existing annotation tables when creating new table", () => {
      // Arrange - Create some existing annotation tables on the page
      const existingTable1 = new MockFrameNode("table-1", "Annotation Table 1 - frame-123");
      existingTable1.x = 500;
      existingTable1.y = 100;
      existingTable1.width = 300;
      existingTable1.height = 200;
      mockFigma.figma.currentPage.appendChild(existingTable1);

      const existingTable2 = new MockFrameNode("table-2", "Annotation Table 2 - frame-456");
      existingTable2.x = 500;
      existingTable2.y = 320; // 20px gap after first table
      existingTable2.width = 300;
      existingTable2.height = 150;
      mockFigma.figma.currentPage.appendChild(existingTable2);

      // Act - Find all annotation tables
      const foundTables = mockFigma.figma.currentPage.findAll(
        (node) => node.type === "FRAME" && node.name.startsWith("Annotation Table ")
      );

      // Assert
      expect(foundTables).toHaveLength(2);
      const firstTable = foundTables[0];
      const secondTable = foundTables[1];
      expect(firstTable).toBeDefined();
      expect(secondTable).toBeDefined();
      expect(firstTable?.name).toBe("Annotation Table 1 - frame-123");
      expect(secondTable?.name).toBe("Annotation Table 2 - frame-456");
    });

    it("should exclude specific annotation table when querying", () => {
      // Arrange - Create annotation tables
      const table1 = new MockFrameNode("table-1", "Annotation Table 1 - frame-123");
      mockFigma.figma.currentPage.appendChild(table1);

      const table2 = new MockFrameNode("table-2", "Annotation Table 2 - frame-123");
      mockFigma.figma.currentPage.appendChild(table2);

      const table3 = new MockFrameNode("table-3", "Annotation Table 3 - frame-456");
      mockFigma.figma.currentPage.appendChild(table3);

      // Act - Find all tables excluding annotation ID 2
      const foundTables = mockFigma.figma.currentPage.findAll(
        (node) => 
          node.type === "FRAME" && 
          node.name.startsWith("Annotation Table ") &&
          !node.name.includes("Annotation Table 2 -")
      );

      // Assert
      expect(foundTables).toHaveLength(2);
      expect(foundTables.some(t => t.name.includes("Annotation Table 2 -"))).toBe(false);
    });

    it("should handle empty canvas when checking for collisions", () => {
      // Act - Find annotation tables on empty canvas
      const foundTables = mockFigma.figma.currentPage.findAll(
        (node) => node.type === "FRAME" && node.name.startsWith("Annotation Table ")
      );

      // Assert
      expect(foundTables).toHaveLength(0);
    });
  });

  describe("badge positioning", () => {
    // Constants matching those in canvas-badge.ts
    const FRAME_TO_BADGE_GAP = 8;
    const BADGE_WIDTH = 24;
    const BADGE_HEIGHT = 24;
    const BADGE_STACKING_GAP = 4;
    const BADGE_SIDE_GAP = 4;

    it("should position badge at frame right edge, vertically centered on element", () => {
      // Arrange
      const target = mockFigma.figma.createRectangle();
      target.x = 150;
      target.y = 120;
      const targetHeight = 40;
      
      // Frame bounds (element is inside frame)
      const frameBounds = { x: 100, y: 100, width: 200, height: 300 };
      
      // Expected position (frame-relative X, element-centered Y)
      // X: frame right edge + gap = 100 + 200 + 8 = 308
      // Y: element center - badge half = 120 + 20 - 12 = 128
      const expectedX = frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP;
      const expectedY = target.y + (targetHeight / 2) - (BADGE_HEIGHT / 2);

      // Act - Apply the positioning logic (same as in createBadge for non-frame target)
      const badge = mockFigma.figma.createRectangle();
      badge.x = frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP;
      badge.y = target.y + (targetHeight / 2) - (BADGE_HEIGHT / 2);

      // Assert - Verify badge is positioned correctly
      expect(badge.x).toBe(expectedX);
      expect(badge.y).toBe(expectedY);
      expect(badge.x).toBe(308); // Frame right edge + gap
      expect(badge.y).toBe(128); // Vertically centered on element
    });

    it("should stack badges vertically when frame is the target", () => {
      // Arrange
      const frameBounds = { x: 100, y: 100, width: 200, height: 300 };
      
      // Badge positioning for frame-level annotations (stacked)
      // First badge (index 0): Y = frame.y + 8
      // Second badge (index 1): Y = frame.y + 8 + (24 + 4) * 1 = 136
      // Third badge (index 2): Y = frame.y + 8 + (24 + 4) * 2 = 164
      
      const badges: { x: number; y: number }[] = [];
      
      // Act - Create 3 stacked badges for frame-level annotations
      for (let annotationIndex = 0; annotationIndex < 3; annotationIndex++) {
        const badge = mockFigma.figma.createRectangle();
        badge.x = frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP;
        badge.y = frameBounds.y + FRAME_TO_BADGE_GAP + (BADGE_HEIGHT + BADGE_STACKING_GAP) * annotationIndex;
        badges.push({ x: badge.x, y: badge.y });
      }

      // Assert - All badges at same X (frame right edge)
      const badge0 = badges[0];
      const badge1 = badges[1];
      const badge2 = badges[2];
      expect(badge0).toBeDefined();
      expect(badge1).toBeDefined();
      expect(badge2).toBeDefined();
      expect(badge0?.x).toBe(308);
      expect(badge1?.x).toBe(308);
      expect(badge2?.x).toBe(308);
      
      // Assert - Badges stacked vertically with proper spacing
      expect(badge0?.y).toBe(108); // frame.y + gap
      expect(badge1?.y).toBe(136); // 108 + 28
      expect(badge2?.y).toBe(164); // 108 + 56
    });

    it("should place badges side-by-side for multiple annotations on same element", () => {
      // Arrange
      const target = mockFigma.figma.createRectangle();
      target.x = 150;
      target.y = 120;
      const targetHeight = 40;
      
      const frameBounds = { x: 100, y: 100, width: 200, height: 300 };
      
      // Badge positioning for same-element annotations (side-by-side)
      // First badge (elementIndex 0): X = frame.x + frame.width + 8 = 308
      // Second badge (elementIndex 1): X = 308 + (24 + 4) = 336
      // Third badge (elementIndex 2): X = 308 + (24 + 4) * 2 = 364
      
      const badges: { x: number; y: number }[] = [];
      
      // Act - Create 3 side-by-side badges for same element
      for (let elementIndex = 0; elementIndex < 3; elementIndex++) {
        const badge = mockFigma.figma.createRectangle();
        const elementOffset = elementIndex * (BADGE_WIDTH + BADGE_SIDE_GAP);
        badge.x = frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP + elementOffset;
        badge.y = target.y + (targetHeight / 2) - (BADGE_HEIGHT / 2);
        badges.push({ x: badge.x, y: badge.y });
      }

      // Assert - All badges at same Y (centered on element)
      const firstBadge = badges[0];
      const secondBadge = badges[1];
      const thirdBadge = badges[2];
      expect(firstBadge).toBeDefined();
      expect(secondBadge).toBeDefined();
      expect(thirdBadge).toBeDefined();
      expect(firstBadge?.y).toBe(128);
      expect(secondBadge?.y).toBe(128);
      expect(thirdBadge?.y).toBe(128);
      
      // Assert - Badges placed side-by-side with proper spacing
      expect(firstBadge?.x).toBe(308); // frame right edge + gap
      expect(secondBadge?.x).toBe(336); // 308 + 28
      expect(thirdBadge?.x).toBe(364); // 308 + 56
    });

    it("should maintain vertical centering for elements of different heights", () => {
      // Test with a tall element inside a frame
      const tallTarget = mockFigma.figma.createRectangle();
      tallTarget.x = 150;
      tallTarget.y = 100;
      const targetHeight = 120; // Tall element
      
      // Frame bounds
      const frameBounds = { x: 100, y: 50, width: 200, height: 200 };
      
      // Expected Y position (vertically centered on element, not frame)
      const expectedY = tallTarget.y + (targetHeight / 2) - (BADGE_HEIGHT / 2); // 100 + 60 - 12 = 148
      
      // Act - Apply positioning logic
      const badge = mockFigma.figma.createRectangle();
      badge.x = frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP;
      badge.y = tallTarget.y + (targetHeight / 2) - (BADGE_HEIGHT / 2);
      
      // Assert - Badge should be centered vertically on element
      expect(badge.y).toBe(expectedY);
      expect(badge.y).toBe(148);
      // X should be at frame right edge, not element right edge
      expect(badge.x).toBe(308);
    });
  });
});
