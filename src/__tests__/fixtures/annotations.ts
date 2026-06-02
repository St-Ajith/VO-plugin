// ============================================================================
// TEST FIXTURES - Sample Annotation Data
// ============================================================================

import type { Annotation } from "../../types";

/**
 * Create a valid mobile annotation with all required fields
 */
export function createMobileAnnotation(
  overrides: Partial<Annotation> = {}
): Annotation {
  const now = Date.now();
  return {
    id: 1,
    frameId: "frame-1",
    frameName: "Test Frame",
    pageId: "page-1",
    pageName: "Test Page",
    platform: "mobile",
    elementId: "element-1",
    elementName: "Test Element",
    voicedPreview: '"Test Button. Button."',
    targetElementId: null,
    createdAt: now,
    updatedAt: now,
    mobile: {
      ios: { label: "Test Button", value: "", trait: "Button", hint: "" },
      android: { label: "Test Button", value: "", trait: "Button", hint: "" },
    },
    ...overrides,
  };
}

/**
 * Create a valid web annotation with all required fields
 */
export function createWebAnnotation(
  overrides: Partial<Annotation> = {}
): Annotation {
  const now = Date.now();
  return {
    id: 1,
    frameId: "frame-1",
    frameName: "Test Frame",
    pageId: "page-1",
    pageName: "Test Page",
    platform: "web",
    elementId: "element-1",
    elementName: "Test Element",
    voicedPreview: '"Test Button"',
    targetElementId: null,
    createdAt: now,
    updatedAt: now,
    web: {
      ariaLabel: "Test Button",
      role: "button",
      ariaDescribedBy: "",
      tabIndex: "0",
    },
    ...overrides,
  };
}

/**
 * Create an invalid annotation (missing required fields)
 */
export function createInvalidAnnotation(): Partial<Annotation> {
  return {
    id: 1,
    // Missing: elementId, platform, mobile/web
    frameId: "frame-1",
    frameName: "Test Frame",
  } as Partial<Annotation>;
}

/**
 * Create a set of annotations for testing change detection
 */
export function createAnnotationSet(): {
  original: Annotation[];
  modified: Annotation[];
  added: Annotation;
  removed: Annotation;
} {
  const now = Date.now();
  
  const annotation1 = createMobileAnnotation({ id: 1, updatedAt: now });
  const annotation2 = createMobileAnnotation({ id: 2, elementId: "element-2", updatedAt: now });
  const annotation3 = createMobileAnnotation({ id: 3, elementId: "element-3", updatedAt: now });
  
  // Modified version of annotation2 with different label
  const annotation2Modified = createMobileAnnotation({
    id: 2,
    elementId: "element-2",
    updatedAt: now + 1000,
    mobile: {
      ios: { label: "Modified Label", value: "", trait: "Button", hint: "" },
      android: { label: "Modified Label", value: "", trait: "Button", hint: "" },
    },
  });
  
  // New annotation not in original
  const annotation4 = createMobileAnnotation({ id: 4, elementId: "element-4", updatedAt: now });
  
  return {
    original: [annotation1, annotation2, annotation3],
    modified: [annotation1, annotation2Modified, annotation4], // annotation3 removed, annotation4 added
    added: annotation4,
    removed: annotation3,
  };
}

/**
 * Create duplicate annotations for deduplication testing
 */
export function createDuplicateAnnotations(): Annotation[] {
  const now = Date.now();
  return [
    createMobileAnnotation({ id: 1, updatedAt: now }),
    createMobileAnnotation({ id: 1, updatedAt: now }), // Duplicate ID
    createMobileAnnotation({ id: 2, elementId: "element-2", updatedAt: now }),
    createMobileAnnotation({ id: 2, elementId: "element-2", updatedAt: now }), // Duplicate ID
    createMobileAnnotation({ id: 3, elementId: "element-3", updatedAt: now }),
  ];
}
