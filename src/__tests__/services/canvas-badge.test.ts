// ============================================================================
// CANVAS BADGE TESTS - Badge Metadata Storage Operations
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BadgeRenderer } from "../../services/canvas-badge";
import { createMockFigma, MockFrameNode } from "../mocks/figma";
import { type BadgeMetadata } from "../../types";
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
  };
});

describe("BadgeRenderer - Metadata Operations", () => {
  let badgeRenderer: BadgeRenderer;
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    mockFigma = createMockFigma();
    (globalThis as Record<string, unknown>).figma = mockFigma.figma;
    badgeRenderer = new BadgeRenderer();
  });

  afterEach(() => {
    mockFigma.reset();
  });

  // ==========================================================================
  // Metadata Storage Tests
  // ==========================================================================

  describe("storeBadgeMetadata", () => {
    it("should store metadata correctly", () => {
      const consoleMock = mockConsole();
      const badge = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const frameId = "frame-123";
      const annotationId = 1;
      const version = 1;
      const timestamp = 1234567890;

      badgeRenderer.storeBadgeMetadata(
        badge as unknown as FrameNode,
        frameId,
        annotationId,
        version,
        timestamp
      );

      const metadataStr = badge.getPluginData(
        "voice_over_annotations_badgeMetadata"
      );
      expect(metadataStr).not.toBe("");
      const metadata = JSON.parse(metadataStr) as BadgeMetadata;
      expect(metadata.sourceFrameId).toBe(frameId);
      expect(metadata.annotationId).toBe(annotationId);
      expect(metadata.version).toBe(version);
      expect(metadata.timestamp).toBe(timestamp);

      consoleMock.restore();
    });

    it("should use default version and timestamp when not provided", () => {
      const consoleMock = mockConsole();
      const badge = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const timestampBefore = Date.now();

      badgeRenderer.storeBadgeMetadata(
        badge as unknown as FrameNode,
        "frame-123",
        1
      );

      const metadataStr = badge.getPluginData(
        "voice_over_annotations_badgeMetadata"
      );
      const metadata = JSON.parse(metadataStr) as BadgeMetadata;
      expect(metadata.version).toBe(1);
      expect(metadata.timestamp).toBeGreaterThanOrEqual(timestampBefore);

      consoleMock.restore();
    });
  });

  describe("readBadgeMetadata", () => {
    it("should read metadata correctly", () => {
      const consoleMock = mockConsole();
      const badge = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const metadata: BadgeMetadata = {
        sourceFrameId: "frame-123",
        annotationId: 1,
        version: 1,
        timestamp: 1234567890,
      };

      badge.setPluginData(
        "voice_over_annotations_badgeMetadata",
        JSON.stringify(metadata)
      );

      const readMetadata = badgeRenderer.readBadgeMetadata(
        badge as unknown as FrameNode
      );
      expect(readMetadata).toEqual(metadata);

      consoleMock.restore();
    });

    it("should return null for missing metadata", () => {
      const consoleMock = mockConsole();
      const badge = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );

      const metadata = badgeRenderer.readBadgeMetadata(
        badge as unknown as FrameNode
      );
      expect(metadata).toBeNull();

      consoleMock.restore();
    });

    it("should handle legacy badges without version", () => {
      const consoleMock = mockConsole();
      const badge = new MockFrameNode(
        "badge-1",
        "Annotation Badge 1 - frame-123"
      );
      const legacyMetadata = {
        sourceFrameId: "frame-123",
        annotationId: 1,
        timestamp: 1234567890,
        // No version field
      };

      badge.setPluginData(
        "voice_over_annotations_badgeMetadata",
        JSON.stringify(legacyMetadata)
      );

      const readMetadata = badgeRenderer.readBadgeMetadata(
        badge as unknown as FrameNode
      );
      expect(readMetadata).not.toBeNull();
      expect(readMetadata?.version).toBe(1); // Should default to 1

      consoleMock.restore();
    });
  });

  // ==========================================================================
  // Integration: createBadge stores metadata
  // ==========================================================================

  describe("createBadge", () => {
    it("should automatically store metadata when creating a badge", () => {
      const consoleMock = mockConsole();
      const frameId = "frame-123";
      const annotationId = 5;

      // Create mock target and frame bounds
      const target = new MockFrameNode("target-1", "Target Element");
      target.x = 100;
      target.y = 200;
      target.width = 100;
      target.height = 50;

      const frameBounds = { x: 0, y: 0, width: 400, height: 600 };
      const options = {
        isFrameTarget: true,
        annotationIndex: 0,
        elementIndex: 0,
      };

      // Create groups implementation for mock
      const badge = badgeRenderer.createBadge(
        annotationId,
        frameId,
        target as unknown as SceneNode,
        frameBounds,
        options
      );

      // Verify metadata was stored
      const metadata = badgeRenderer.readBadgeMetadata(badge);
      expect(metadata).not.toBeNull();
      expect(metadata?.sourceFrameId).toBe(frameId);
      expect(metadata?.annotationId).toBe(annotationId);
      expect(metadata?.version).toBe(1);

      consoleMock.restore();
    });
  });
});
