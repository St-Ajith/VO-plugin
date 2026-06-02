// ============================================================================
// TEST FIXTURES - Sample Frame Data
// ============================================================================

import type { Screen } from "../../types";

/**
 * Create a sample screen/frame
 */
export function createScreen(overrides: Partial<Screen> = {}): Screen {
  return {
    id: "frame-1",
    name: "Test Frame",
    ...overrides,
  };
}

/**
 * Create a set of screens for testing
 */
export function createScreenSet(): Screen[] {
  return [
    createScreen({ id: "frame-1", name: "Login Screen" }),
    createScreen({ id: "frame-2", name: "Home Screen" }),
    createScreen({ id: "frame-3", name: "Settings Screen" }),
  ];
}

/**
 * Frame info structure returned by frame detection
 */
export interface FrameInfo {
  id: string;
  name: string;
  pageId: string;
  pageName: string;
}

/**
 * Create frame info for testing
 */
export function createFrameInfo(overrides: Partial<FrameInfo> = {}): FrameInfo {
  return {
    id: "frame-1",
    name: "Test Frame",
    pageId: "page-1",
    pageName: "Test Page",
    ...overrides,
  };
}
