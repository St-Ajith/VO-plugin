// ============================================================================
// ANNOTATION HELPERS - Annotation-specific utility functions
// ============================================================================
// Thin compatibility layer over the data-driven annotation generator.
// The classification/label/hint logic now lives in ./annotation-generator;
// this module preserves the historical `extractElementMetadata` shape and
// adds the frame-level generation entry point.
// ============================================================================

import type { Annotation } from "../types";
import {
  buildFields,
  collectFocusableElements,
  type GenerateOptions,
} from "./annotation-generator";

export interface FrameInfo {
  id: string;
  name: string;
  pageId: string;
  pageName: string;
}

/**
 * Assemble a complete Annotation from a node, deriving all accessibility
 * fields via the generator. Shared by the single-select create flow and the
 * frame-level auto-generate flow so field shape stays identical.
 */
export function assembleAnnotation(
  node: SceneNode,
  id: number,
  platform: "mobile" | "web",
  frame: FrameInfo,
  options: GenerateOptions = {}
): Annotation {
  const f = buildFields(node, options);
  const now = Date.now();
  return {
    id,
    frameId: frame.id,
    frameName: frame.name,
    pageId: frame.pageId,
    pageName: frame.pageName,
    platform,
    elementId: node.id,
    elementName: node.name || "Unnamed Element",
    voicedPreview: f.voicedPreview,
    targetElementId: node.id,
    createdAt: now,
    updatedAt: now,
    mobile: {
      ios: { label: f.label, value: f.value, trait: f.trait, hint: f.hintIOS },
      android: {
        label: `${f.label} (contentDescription)`,
        value: f.value,
        trait: f.trait,
        hint: f.hintAndroid,
      },
    },
    web: {
      ariaLabel: f.label,
      role: f.role,
      ariaDescribedBy: "n/a",
      tabIndex: id.toString(),
    },
  };
}

export {
  classifyElement,
  collectFocusableElements,
  deriveLabel,
  setGeneratorLocale,
  getGeneratorLocale,
  type Locale,
  type RoleKey,
} from "./annotation-generator";

/**
 * Extract element metadata and generate intelligent defaults for a single
 * element. Kept for backward compatibility with the single-select create flow.
 */
export function extractElementMetadata(
  element: SceneNode,
  options: GenerateOptions = {}
): {
  elementType: string;
  textContent: string;
  voicedPreview: string;
  suggestedRole: string;
  suggestedTrait: string;
  suggestedHintIOS: string;
  suggestedHintAndroid: string;
} {
  const fields = buildFields(element, options);
  return {
    elementType: fields.elementType,
    // `textContent` historically meant "the label-ish text"; map to label.
    textContent: fields.value === "n/a" ? "" : fields.label,
    voicedPreview: fields.voicedPreview,
    suggestedRole: fields.role,
    suggestedTrait: fields.trait,
    suggestedHintIOS: fields.hintIOS,
    suggestedHintAndroid: fields.hintAndroid,
  };
}

/**
 * Generate annotation field drafts for every focusable element in a frame,
 * in reading order. Each entry pairs the source node with its derived fields;
 * the caller assembles full Annotation objects (assigning IDs, timestamps and
 * the mobile/web split).
 */
export function generateFrameFieldDrafts(
  frame: FrameNode | SectionNode,
  options: GenerateOptions = {}
): Array<{ node: SceneNode; fields: ReturnType<typeof buildFields> }> {
  return collectFocusableElements(frame).map((node) => ({
    node,
    fields: buildFields(node, options),
  }));
}
