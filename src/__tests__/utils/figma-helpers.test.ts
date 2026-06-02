// ============================================================================
// FIGMA HELPERS TESTS - Naming Convention Detection
// ============================================================================

import { describe, it, expect } from "vitest";
import { parseTaggedName, findTaggedElements } from "../../utils/figma-helpers";
import { createMockFigma, MockFrameNode } from "../mocks/figma";

describe("Figma Helpers - Naming Convention", () => {
  describe("parseTaggedName", () => {
    it("should parse simple label and trait", () => {
      const result = parseTaggedName("vo-label-trait Back Button");
      expect(result).toEqual({ label: "Back", trait: "Button" });
    });

    it("should parse multi-word label with single-word trait", () => {
      const result = parseTaggedName("vo-label-trait Choose a ride Header");
      expect(result).toEqual({ label: "Choose a ride", trait: "Header" });
    });

    it("should parse complex label with trait", () => {
      const result = parseTaggedName("vo-label-trait UberX $14.95 Button");
      expect(result).toEqual({ label: "UberX $14.95", trait: "Button" });
    });

    it("should return null for names without prefix", () => {
      const result = parseTaggedName("Regular Layer Name");
      expect(result).toBeNull();
    });

    it("should return null for prefix-only name", () => {
      const result = parseTaggedName("vo-label-trait ");
      expect(result).toBeNull();
    });

    it("should return null for empty prefix", () => {
      const result = parseTaggedName("vo-label-trait");
      expect(result).toBeNull();
    });

    it("should handle single word after prefix", () => {
      const result = parseTaggedName("vo-label-trait Button");
      expect(result).toEqual({ label: "Button", trait: "Button" });
    });

    it("should handle extra whitespace", () => {
      const result = parseTaggedName("vo-label-trait   Back   Button  ");
      expect(result).toEqual({ label: "Back", trait: "Button" });
    });

    it("should be case-sensitive for prefix", () => {
      const result = parseTaggedName("VO-LABEL-TRAIT Back Button");
      expect(result).toBeNull();
    });
  });

  describe("findTaggedElements", () => {
    it("should find elements with vo-label-trait prefix", () => {
      const mockFigma = createMockFigma();
      (globalThis as Record<string, unknown>).figma = mockFigma.figma;

      // Create a frame with tagged elements
      const frame = new MockFrameNode("frame-1", "Test Frame");
      
      // Add tagged elements
      const taggedElement1 = new MockFrameNode("element-1", "vo-label-trait Back Button");
      const taggedElement2 = new MockFrameNode("element-2", "vo-label-trait Next Button");
      const regularElement = new MockFrameNode("element-3", "Regular Element");
      
      // Mock findAll to return our test elements
      const mockFindAll = (predicate: (node: SceneNode) => boolean) => {
        const nodes = [taggedElement1, taggedElement2, regularElement];
        return nodes.filter((n) => predicate(n as unknown as SceneNode)) as unknown as SceneNode[];
      };
      
      (frame as unknown as Record<string, unknown>).findAll = mockFindAll;

      const result = findTaggedElements(frame as unknown as FrameNode);
      
      expect(result.length).toBe(2);
      const firstResult = result[0];
      const secondResult = result[1];
      expect(firstResult).toBeDefined();
      expect(secondResult).toBeDefined();
      expect(firstResult?.name).toBe("vo-label-trait Back Button");
      expect(secondResult?.name).toBe("vo-label-trait Next Button");

      mockFigma.reset();
    });

    it("should return empty array when no tagged elements found", () => {
      const mockFigma = createMockFigma();
      (globalThis as Record<string, unknown>).figma = mockFigma.figma;

      const frame = new MockFrameNode("frame-1", "Test Frame");
      
      // Mock findAll to return empty array
      (frame as unknown as Record<string, unknown>).findAll = () => [];

      const result = findTaggedElements(frame as unknown as FrameNode);
      
      expect(result.length).toBe(0);

      mockFigma.reset();
    });

    it("should exclude annotation tables from results", () => {
      const mockFigma = createMockFigma();
      (globalThis as Record<string, unknown>).figma = mockFigma.figma;

      const frame = new MockFrameNode("frame-1", "Test Frame");
      
      // Add tagged element and annotation table with prefix
      const taggedElement = new MockFrameNode("element-1", "vo-label-trait Back Button");
      const annotationTable = new MockFrameNode("table-1", "Annotation Table 1 - frame-1");
      
      const mockFindAll = (predicate: (node: SceneNode) => boolean) => {
        const nodes = [taggedElement, annotationTable];
        return nodes.filter((n) => predicate(n as unknown as SceneNode)) as unknown as SceneNode[];
      };
      
      (frame as unknown as Record<string, unknown>).findAll = mockFindAll;

      const result = findTaggedElements(frame as unknown as FrameNode);
      
      // Should only include the tagged element, not the annotation table
      expect(result.length).toBe(1);
      const firstResult = result[0];
      expect(firstResult).toBeDefined();
      expect(firstResult?.name).toBe("vo-label-trait Back Button");

      mockFigma.reset();
    });
  });
});
