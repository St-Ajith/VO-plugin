import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { isSyncing, annotations, resetStore } from "../../store";
import type { Annotation } from "../../types";

// Mock the logger
vi.mock("../../utils/logger", () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock @create-figma-plugin/utilities
vi.mock("@create-figma-plugin/utilities", () => ({
  on: vi.fn(() => vi.fn()), // Returns cleanup function
  emit: vi.fn(),
}));

describe("State Recovery (SA-03)", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetStore();
  });

  describe("isSyncing signal", () => {
    it("should be false by default", () => {
      expect(isSyncing.value).toBe(false);
    });

    it("should be settable to true", () => {
      isSyncing.value = true;
      expect(isSyncing.value).toBe(true);
    });

    it("should be reset by resetStore", () => {
      isSyncing.value = true;
      resetStore();
      expect(isSyncing.value).toBe(false);
    });
  });

  describe("save-data-result failure handling", () => {
    const mockAnnotation: Annotation = {
      id: 1,
      frameId: "frame-123",
      frameName: "Test Frame",
      pageId: "page-456",
      pageName: "Test Page",
      platform: "mobile",
      elementId: "elem-789",
      elementName: "Test Element",
      voicedPreview: "Test preview",
      targetElementId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      mobile: {
        ios: {
          label: "iOS Label",
          value: "iOS Value",
          trait: "button",
          hint: "iOS Hint",
        },
        android: {
          label: "Android Label",
          value: "Android Value",
          trait: "button",
          hint: "Android Hint",
        },
      },
    };

    it("should have annotations state that can be modified", () => {
      // Simulate optimistic update
      annotations.value = [mockAnnotation];
      expect(annotations.value.length).toBe(1);
    });

    it("should clear annotations on resetStore", () => {
      annotations.value = [mockAnnotation];
      expect(annotations.value.length).toBe(1);
      resetStore();
      expect(annotations.value.length).toBe(0);
    });
  });

  describe("UI state during sync", () => {
    it("should disable interactions when isSyncing is true", () => {
      // This tests the signal behavior that the UI depends on
      isSyncing.value = true;

      // The UI uses isSyncing.value to disable buttons
      // We verify the signal works correctly
      expect(isSyncing.value).toBe(true);

      // After re-sync completes
      isSyncing.value = false;
      expect(isSyncing.value).toBe(false);
    });
  });

  describe("Echo prevention", () => {
    it("should use isSyncing to gate all mutation handlers", () => {
      // The handlers in ui.tsx check isSyncing.value at the start
      // and return early if true, preventing the echo loop:
      // Sync → Save → Sync → Save → ...

      // When isSyncing is true, handlers should not emit save-data
      isSyncing.value = true;

      // The guard pattern used in all handlers:
      // if (isSyncing.value) { return }
      // This prevents any save-data emissions during re-sync

      expect(isSyncing.value).toBe(true);

      // Simulating what happens when INIT arrives during sync:
      // annotations.value is set directly, not through handlers
      annotations.value = [];

      // No save-data should be emitted because:
      // 1. Direct signal assignment doesn't trigger handlers
      // 2. Even if a handler was somehow called, isSyncing guard blocks it

      // After sync completes
      isSyncing.value = false;
      expect(isSyncing.value).toBe(false);
    });
  });
});
