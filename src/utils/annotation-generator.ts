// ============================================================================
// ANNOTATION GENERATOR - Frame-context-aware annotation generation
// ============================================================================
// Reads a Figma element (or walks a whole frame) and derives accessibility
// metadata for VoiceOver / TalkBack / ARIA.
//
// Design goals:
//  - Data-driven: roles live in a single ROLE_TABLE, not an if/else chain.
//  - Signal priority: explicit tag > component/name keyword > structure/text.
//  - Localisable: hint copy lives in HINT_PACKS keyed by locale, not in logic.
//  - Frame-first: collectFocusableElements() walks a frame and returns the
//    elements that each deserve their own annotation, in reading order.
// ============================================================================

import { parseTaggedName, isAnnotationTable } from "./figma-helpers";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type RoleKey =
  | "button"
  | "link"
  | "input"
  | "checkbox"
  | "radio"
  | "switch"
  | "image"
  | "heading"
  | "text"
  | "group";

export type Locale = "nb" | "en";

export type ClassificationSource =
  | "tag" // matched vo-label-trait naming convention
  | "component" // COMPONENT / INSTANCE name keyword
  | "name" // layer name keyword
  | "structure" // inferred from node type / fills
  | "text"; // plain text node

export interface RoleDefinition {
  /** Human-readable type name used in the voiced preview. */
  typeName: string;
  /** VoiceOver / TalkBack trait. */
  trait: string;
  /** ARIA role for the web platform. */
  webRole: string;
  /** Keywords matched (case-insensitive substring) against a node name. */
  keywords: string[];
  /** Whether this role is an interactive control (controls get a hint). */
  interactive: boolean;
}

export interface ElementClassification {
  role: RoleKey;
  /** Explicit label from a tag, when present (overrides derived label). */
  taggedLabel?: string;
  /** Explicit trait from a tag, when present (overrides table trait). */
  taggedTrait?: string;
  source: ClassificationSource;
}

export interface GeneratedFields {
  elementType: string;
  label: string;
  value: string;
  trait: string;
  role: string;
  hintIOS: string;
  hintAndroid: string;
  voicedPreview: string;
}

export interface GenerateOptions {
  locale?: Locale;
}

// ----------------------------------------------------------------------------
// Role table (single source of truth — replaces the old if/else chain)
// ----------------------------------------------------------------------------
// Order matters: classification scans this list top-to-bottom, so more
// specific roles (switch, checkbox, radio) must precede broader ones.

const ROLE_TABLE: Record<RoleKey, RoleDefinition> = {
  switch: {
    typeName: "Switch",
    trait: "Button",
    webRole: "switch",
    keywords: ["switch", "toggle"],
    interactive: true,
  },
  checkbox: {
    typeName: "Checkbox",
    trait: "Button",
    webRole: "checkbox",
    keywords: ["checkbox", "check"],
    interactive: true,
  },
  radio: {
    typeName: "Radio Button",
    trait: "Button",
    webRole: "radio",
    keywords: ["radio"],
    interactive: true,
  },
  input: {
    typeName: "Input Field",
    trait: "Text Field",
    webRole: "textbox",
    keywords: ["input", "field", "textbox", "textfield", "search"],
    interactive: true,
  },
  button: {
    typeName: "Button",
    trait: "Button",
    webRole: "button",
    keywords: ["button", "btn", "cta"],
    interactive: true,
  },
  link: {
    typeName: "Link",
    trait: "Link",
    webRole: "link",
    keywords: ["link", "anchor"],
    interactive: true,
  },
  heading: {
    typeName: "Heading",
    trait: "Header",
    webRole: "heading",
    keywords: ["header", "heading", "title", "headline"],
    interactive: false,
  },
  image: {
    typeName: "Image",
    trait: "Image",
    webRole: "img",
    keywords: ["image", "img", "icon", "avatar", "logo", "illustration"],
    interactive: false,
  },
  text: {
    typeName: "Text",
    trait: "Static Text",
    webRole: "text",
    keywords: [],
    interactive: false,
  },
  group: {
    typeName: "Group",
    trait: "None",
    webRole: "group",
    keywords: [],
    interactive: false,
  },
};

/** Priority order used when scanning name keywords. */
const ROLE_SCAN_ORDER: RoleKey[] = [
  "switch",
  "checkbox",
  "radio",
  "input",
  "button",
  "link",
  "heading",
  "image",
];

// ----------------------------------------------------------------------------
// Hint packs (locale-specific copy — pulled out of logic)
// ----------------------------------------------------------------------------

type HintBuilder = (label: string) => { ios: string; android: string };
type HintPack = Partial<Record<RoleKey, HintBuilder>>;

const HINT_PACKS: Record<Locale, HintPack> = {
  nb: {
    button: (l) => ({
      ios: l ? `Dobbelttrykk for å åpne ${l}` : "Dobbelttrykk for å åpne",
      android: l
        ? `Dobbelttrykk for å aktivere ${l}`
        : "Dobbelttrykk for å aktivere",
    }),
    link: (l) => ({
      ios: l ? `Dobbelttrykk for å åpne ${l}` : "Dobbelttrykk for å åpne lenke",
      android: l
        ? `Dobbelttrykk for å åpne ${l}`
        : "Dobbelttrykk for å åpne lenke",
    }),
    input: (l) => ({
      ios: l ? `Skriv inn ${l}` : "Skriv inn tekst",
      android: l ? `Skriv inn ${l}` : "Skriv inn tekst",
    }),
    checkbox: () => ({
      ios: "Dobbelttrykk for å velge eller fjerne valg",
      android: "Dobbelttrykk for å velge eller fjerne valg",
    }),
    radio: () => ({
      ios: "Dobbelttrykk for å velge dette alternativet",
      android: "Dobbelttrykk for å velge dette alternativet",
    }),
    switch: () => ({
      ios: "Dobbelttrykk for å slå av eller på",
      android: "Dobbelttrykk for å slå av eller på",
    }),
  },
  en: {
    button: (l) => ({
      ios: l ? `Double-tap to open ${l}` : "Double-tap to open",
      android: l ? `Double-tap to activate ${l}` : "Double-tap to activate",
    }),
    link: (l) => ({
      ios: l ? `Double-tap to open ${l}` : "Double-tap to open link",
      android: l ? `Double-tap to open ${l}` : "Double-tap to open link",
    }),
    input: (l) => ({
      ios: l ? `Enter ${l}` : "Enter text",
      android: l ? `Enter ${l}` : "Enter text",
    }),
    checkbox: () => ({
      ios: "Double-tap to select or deselect",
      android: "Double-tap to select or deselect",
    }),
    radio: () => ({
      ios: "Double-tap to select this option",
      android: "Double-tap to select this option",
    }),
    switch: () => ({
      ios: "Double-tap to toggle on or off",
      android: "Double-tap to toggle on or off",
    }),
  },
};

// ----------------------------------------------------------------------------
// Module-level locale (settable per project; defaults to today's behaviour)
// ----------------------------------------------------------------------------

let activeLocale: Locale = "nb";

export function setGeneratorLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getGeneratorLocale(): Locale {
  return activeLocale;
}

// ----------------------------------------------------------------------------
// Small, defensive node readers (kept free of the `figma` global so they are
// trivially unit-testable with plain object fixtures)
// ----------------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getBox(node: SceneNode): Box {
  const abs = (node as { absoluteBoundingBox?: Box | null })
    .absoluteBoundingBox;
  if (abs) return abs;
  const x = "x" in node ? (node as { x: number }).x : 0;
  const y = "y" in node ? (node as { y: number }).y : 0;
  const width = "width" in node ? (node as { width: number }).width : 0;
  const height = "height" in node ? (node as { height: number }).height : 0;
  return { x, y, width, height };
}

function isContainer(
  node: SceneNode
): node is SceneNode & { findAll: FrameNode["findAll"]; children: readonly SceneNode[] } {
  return "children" in node && "findAll" in node;
}

function hasVisibleImageFill(node: SceneNode): boolean {
  const fills = (node as { fills?: readonly Paint[] | symbol }).fills;
  if (!Array.isArray(fills)) return false;
  return (fills as readonly Paint[]).some(
    (f) => f.visible !== false && f.type === "IMAGE"
  );
}

/** Layer names Figma auto-assigns carry no semantic signal. */
function isJunkName(name: string): boolean {
  return /^(frame|group|rectangle|ellipse|vector|polygon|star|line|component|instance|union|subtract|intersect|exclude|slice|mask)\s*\d*$/i.test(
    name.trim()
  );
}

/** Plugin scaffolding that must never be annotated. */
function isScaffolding(node: SceneNode): boolean {
  return (
    isAnnotationTable(node) ||
    node.name.startsWith("Annotation Container") ||
    node.name.startsWith("Annotation Badge")
  );
}

function matchRoleByKeyword(name: string): RoleKey | null {
  const lower = name.toLowerCase();
  for (const role of ROLE_SCAN_ORDER) {
    if (ROLE_TABLE[role].keywords.some((kw) => lower.includes(kw))) {
      return role;
    }
  }
  return null;
}

/** Map a free-text trait (from a tag) onto a known role, best-effort. */
function roleFromTraitWord(trait: string): RoleKey {
  return matchRoleByKeyword(trait) ?? "text";
}

// ----------------------------------------------------------------------------
// Classification — the heart of "understand the element"
// ----------------------------------------------------------------------------

export function classifyElement(node: SceneNode): ElementClassification {
  // 1. Explicit tag (highest trust — the designer told us).
  const tag = parseTaggedName(node.name);
  if (tag) {
    return {
      role: roleFromTraitWord(tag.trait),
      taggedLabel: tag.label,
      taggedTrait: tag.trait,
      source: "tag",
    };
  }

  // 2. Plain text node → static text (unless its name says heading).
  if (node.type === "TEXT") {
    const byName = matchRoleByKeyword(node.name);
    if (byName === "heading") return { role: "heading", source: "name" };
    return { role: "text", source: "text" };
  }

  // 3. Component / instance name (a trusted signal in design-system files).
  if (node.type === "COMPONENT" || node.type === "INSTANCE") {
    const byComponent = matchRoleByKeyword(node.name);
    if (byComponent) return { role: byComponent, source: "component" };
  }

  // 4. Generic layer-name keyword.
  const byName = matchRoleByKeyword(node.name);
  if (byName) return { role: byName, source: "name" };

  // 5. Structural fallback for unstructured names ("Frame 12").
  if (
    node.type === "RECTANGLE" ||
    node.type === "ELLIPSE" ||
    node.type === "POLYGON" ||
    node.type === "STAR" ||
    node.type === "VECTOR"
  ) {
    return { role: "image", source: "structure" };
  }
  if (hasVisibleImageFill(node)) {
    return { role: "image", source: "structure" };
  }

  return { role: "group", source: "structure" };
}

// ----------------------------------------------------------------------------
// Label derivation — pick ONE meaningful label, never join every text node
// ----------------------------------------------------------------------------

function readChars(node: SceneNode): string {
  return node.type === "TEXT" ? node.characters.trim() : "";
}

export function deriveLabel(node: SceneNode, classification?: ElementClassification): string {
  const cls = classification ?? classifyElement(node);
  if (cls.taggedLabel) return cls.taggedLabel;

  if (node.type === "TEXT") {
    const chars = readChars(node);
    if (chars) return chars;
  }

  // First non-empty text descendant in reading order — not all of them joined.
  if (isContainer(node)) {
    const texts = node
      .findAll((n) => n.type === "TEXT")
      .filter((n) => n.visible !== false);
    const ordered = [...texts].sort(readingOrderComparator);
    for (const t of ordered) {
      const chars = readChars(t);
      if (chars) return chars;
    }
  }

  // Fall back to the layer name, unless it is auto-generated junk.
  return isJunkName(node.name) ? "" : node.name;
}

// ----------------------------------------------------------------------------
// Field assembly
// ----------------------------------------------------------------------------

export function buildFields(
  node: SceneNode,
  options: GenerateOptions = {}
): GeneratedFields {
  const locale = options.locale ?? activeLocale;
  const cls = classifyElement(node);
  const def = ROLE_TABLE[cls.role];

  const label = deriveLabel(node, cls) || node.name || "Unnamed Element";
  const trait = cls.taggedTrait ?? def.trait;
  const isTextual = cls.role === "text" || cls.role === "heading";
  const value = isTextual ? label : "n/a";

  let hintIOS = "";
  let hintAndroid = "";
  if (def.interactive) {
    const hintLabel = isTextual ? "" : deriveLabel(node, cls);
    const builder = HINT_PACKS[locale][cls.role];
    if (builder) {
      const built = builder(hintLabel);
      hintIOS = built.ios;
      hintAndroid = built.android;
    }
  }

  return {
    elementType: def.typeName,
    label,
    value,
    trait,
    role: def.webRole,
    hintIOS,
    hintAndroid,
    voicedPreview: `"${label}. ${def.typeName}."`,
  };
}

// ----------------------------------------------------------------------------
// Reading order
// ----------------------------------------------------------------------------

/** Rows within this many pixels vertically are treated as the same line. */
const ROW_TOLERANCE = 8;

export function readingOrderComparator(a: SceneNode, b: SceneNode): number {
  const ba = getBox(a);
  const bb = getBox(b);
  if (Math.abs(ba.y - bb.y) <= ROW_TOLERANCE) {
    return ba.x - bb.x; // same row → left-to-right
  }
  return ba.y - bb.y; // otherwise top-to-bottom
}

// ----------------------------------------------------------------------------
// Frame walk — collect the elements that each deserve an annotation
// ----------------------------------------------------------------------------

/**
 * Walk a frame and return the focusable elements in reading order.
 *
 * A node becomes its own annotation when it is a concrete control or piece of
 * content (button, text, image, …). Purely structural containers are skipped
 * and we recurse into them instead — so a card frame yields its inner button
 * and label, not the card wrapper. Tagged elements are always included.
 */
export function collectFocusableElements(
  frame: FrameNode | SectionNode
): SceneNode[] {
  const collected: SceneNode[] = [];

  const visit = (node: SceneNode): void => {
    if (node.visible === false || isScaffolding(node)) return;

    const tagged = parseTaggedName(node.name) !== null;
    const cls = classifyElement(node);
    const isConcrete = cls.role !== "group";

    if (tagged || isConcrete) {
      // Treat as a single unit — don't descend into its internals.
      collected.push(node);
      return;
    }

    // Structural container → recurse.
    if (isContainer(node)) {
      for (const child of node.children) visit(child);
    }
  };

  for (const child of frame.children) visit(child);

  collected.sort(readingOrderComparator);
  return collected;
}
