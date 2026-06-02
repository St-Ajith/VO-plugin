// ============================================================================
// VITEST SETUP - Global mocks and configuration
// ============================================================================

import { vi } from "vitest";

// Vitest 4.0 note: restoreMocks only resets vi.spyOn targets. Automocks we
// define here (e.g., figma, __html__) are not affected by restoreMocks: true
// in vitest.config.ts, so they rely on clearMocks or explicit reset logic.

// Mock the Figma global object
// This is needed because @create-figma-plugin/utilities checks for figma global
const mockFigma = {
  ui: {
    postMessage: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  },
  currentPage: {
    id: "page-1",
    name: "Test Page",
    children: [],
    findAll: vi.fn(() => []),
    findOne: vi.fn(() => null),
    on: vi.fn(),
  },
  root: {
    children: [],
  },
  notify: vi.fn(),
  getNodeByIdAsync: vi.fn(),
  loadAllPagesAsync: vi.fn(),
  clientStorage: {
    getAsync: vi.fn(),
    setAsync: vi.fn(),
    deleteAsync: vi.fn(),
  },
  viewport: {
    scrollAndZoomIntoView: vi.fn(),
  },
  createFrame: vi.fn(),
  createText: vi.fn(),
  createRectangle: vi.fn(),
  createLine: vi.fn(),
  loadFontAsync: vi.fn(),
};

// Set up global figma mock
(globalThis as Record<string, unknown>).figma = mockFigma;

// Mock __html__ which is used by @create-figma-plugin/ui
(globalThis as Record<string, unknown>).__html__ = "";

// Export for test access
export { mockFigma };
