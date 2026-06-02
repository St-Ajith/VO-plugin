// ============================================================================
// STORAGE SERVICE INTEGRATION TESTS
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StorageService } from "../../services/storage";
import { createMockFigma, MockNode } from "../mocks/figma";
import type { Annotation } from "../../types";

describe("StorageService Integration Tests", () => {
  let mockFigma: ReturnType<typeof createMockFigma>;
  let storage: StorageService;

  beforeEach(() => {
    // Create fresh mock instance for isolation
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
    
    storage = new StorageService();
  });

  afterEach(() => {
    mockFigma.reset();
  });

  describe("saveToNode and loadFromNode", () => {
    it("should save annotation to node plugin data", async () => {
      // Arrange
      const testNode = new MockNode("test-node-1", "Test Element", "FRAME");
      mockFigma.addNode(testNode);

      const annotation: Annotation = {
        id: 1,
        frameId: "frame-1",
        frameName: "Screen 1",
        pageId: "page-1",
        pageName: "Page 1",
        platform: "mobile",
        elementId: "test-node-1",
        elementName: "Test Element",
        voicedPreview: "Button, Test",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mobile: {
          ios: { label: "Test", value: "", trait: "button", hint: "" },
          android: { label: "Test", value: "", trait: "button", hint: "" },
        },
      };

      // Act
      await storage.saveToNode("test-node-1", annotation);

      // Assert
      const pluginData = testNode.getPluginData("voice_over_annotations");
      expect(pluginData).toBeTruthy();
      
      const parsedData = JSON.parse(pluginData) as { annotation: Annotation; timestamp: number };
      expect(parsedData.annotation).toEqual(annotation);
      expect(parsedData.timestamp).toBeGreaterThan(0);
    });

    it("should load annotation from node plugin data", async () => {
      // Arrange
      const testNode = new MockNode("test-node-2", "Test Element", "FRAME");
      mockFigma.addNode(testNode);

      const annotation: Annotation = {
        id: 2,
        frameId: "frame-1",
        frameName: "Screen 1",
        pageId: "page-1",
        pageName: "Page 1",
        platform: "web",
        elementId: "test-node-2",
        elementName: "Test Element",
        voicedPreview: "Link, Test",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        web: {
          ariaLabel: "Test",
          role: "link",
          ariaDescribedBy: "",
          tabIndex: "0",
        },
      };

      await storage.saveToNode("test-node-2", annotation);

      // Act
      const loaded = await storage.loadFromNode("test-node-2");

      // Assert
      expect(loaded).toEqual(annotation);
    });

    it("should return null for node without annotation data", async () => {
      // Arrange
      const testNode = new MockNode("test-node-3", "Empty Element", "FRAME");
      mockFigma.addNode(testNode);

      // Act
      const loaded = await storage.loadFromNode("test-node-3");

      // Assert
      expect(loaded).toBeNull();
    });

    it("should return null for removed node", async () => {
      // Arrange
      const testNode = new MockNode("test-node-4", "Test Element", "FRAME");
      mockFigma.addNode(testNode);
      mockFigma.removeNode("test-node-4");

      // Act
      const loaded = await storage.loadFromNode("test-node-4");

      // Assert
      expect(loaded).toBeNull();
    });

    it("should throw error when saving to removed node", async () => {
      // Arrange
      const testNode = new MockNode("test-node-5", "Test Element", "FRAME");
      mockFigma.addNode(testNode);
      mockFigma.removeNode("test-node-5");

      const annotation: Annotation = {
        id: 5,
        frameId: "frame-1",
        frameName: "Screen 1",
        pageId: "page-1",
        pageName: "Page 1",
        platform: "mobile",
        elementId: "test-node-5",
        elementName: "Test Element",
        voicedPreview: "Test",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Act & Assert
      await expect(storage.saveToNode("test-node-5", annotation)).rejects.toThrow();
    });
  });

  describe("removeFromNode", () => {
    it("should remove annotation from node plugin data", async () => {
      // Arrange
      const testNode = new MockNode("test-node-6", "Test Element", "FRAME");
      mockFigma.addNode(testNode);

      const annotation: Annotation = {
        id: 6,
        frameId: "frame-1",
        frameName: "Screen 1",
        pageId: "page-1",
        pageName: "Page 1",
        platform: "mobile",
        elementId: "test-node-6",
        elementName: "Test Element",
        voicedPreview: "Test",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await storage.saveToNode("test-node-6", annotation);
      
      // Verify it was saved
      let pluginData = testNode.getPluginData("voice_over_annotations");
      expect(pluginData).toBeTruthy();

      // Act
      await storage.removeFromNode("test-node-6");

      // Assert
      pluginData = testNode.getPluginData("voice_over_annotations");
      expect(pluginData).toBe("");
    });

    it("should handle removal from already removed node gracefully", async () => {
      // Arrange
      const testNode = new MockNode("test-node-7", "Test Element", "FRAME");
      mockFigma.addNode(testNode);
      mockFigma.removeNode("test-node-7");

      // Act & Assert - should not throw and should complete successfully
      await expect(storage.removeFromNode("test-node-7")).resolves.toBeUndefined();
      
      // Verify it was logged as expected
      expect(mockFigma.wasMethodCalled("getNodeByIdAsync")).toBe(true);
    });
  });

  describe("updateAnnotation", () => {
    it("should update existing annotation data", async () => {
      // Arrange
      const testNode = new MockNode("test-node-8", "Test Element", "FRAME");
      mockFigma.addNode(testNode);

      const originalAnnotation: Annotation = {
        id: 8,
        frameId: "frame-1",
        frameName: "Screen 1",
        pageId: "page-1",
        pageName: "Page 1",
        platform: "mobile",
        elementId: "test-node-8",
        elementName: "Test Element",
        voicedPreview: "Original",
        targetElementId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mobile: {
          ios: { label: "Original", value: "", trait: "button", hint: "" },
          android: { label: "Original", value: "", trait: "button", hint: "" },
        },
      };

      await storage.saveToNode("test-node-8", originalAnnotation);

      const updatedAnnotation: Annotation = {
        ...originalAnnotation,
        voicedPreview: "Updated",
        updatedAt: Date.now() + 1000,
        mobile: {
          ios: { label: "Updated", value: "", trait: "button", hint: "" },
          android: { label: "Updated", value: "", trait: "button", hint: "" },
        },
      };

      // Act
      await storage.saveToNode("test-node-8", updatedAnnotation);
      const loaded = await storage.loadFromNode("test-node-8");

      // Assert
      expect(loaded?.voicedPreview).toBe("Updated");
      expect(loaded?.mobile?.ios.label).toBe("Updated");
    });
  });

  describe("mock isolation", () => {
    it("should not leak data between tests", async () => {
      // This test verifies that beforeEach reset works correctly
      
      // Try to load a node from a previous test
      const loaded = await storage.loadFromNode("test-node-1");
      
      // Should be null because mock was reset
      expect(loaded).toBeNull();
    });

    it("should track Figma API calls", async () => {
      // Arrange
      const testNode = new MockNode("test-node-9", "Test Element", "FRAME");
      mockFigma.addNode(testNode);

      // Act
      await storage.loadFromNode("test-node-9");

      // Assert
      expect(mockFigma.wasMethodCalled("getNodeByIdAsync")).toBe(true);
      const calls = mockFigma.getCallsByMethod("getNodeByIdAsync");
      expect(calls).toHaveLength(1);
      const call = calls[0]!;
      expect(call).toBeDefined();
      expect(call.args[0]).toBe("test-node-9");
    });
  });
});
