import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyElement,
  deriveLabel,
  buildFields,
  collectFocusableElements,
  readingOrderComparator,
  setGeneratorLocale,
} from "../../utils/annotation-generator";

// ----------------------------------------------------------------------------
// Lightweight fixtures (no figma global, no heavy mocks needed)
// ----------------------------------------------------------------------------

interface NodeInit {
  id?: string;
  name: string;
  type: string;
  characters?: string;
  visible?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Array<{ type: string; visible?: boolean }>;
  children?: SceneNode[];
}

let counter = 0;

function node(init: NodeInit): SceneNode {
  const id = init.id ?? `n${counter++}`;
  const x = init.x ?? 0;
  const y = init.y ?? 0;
  const width = init.width ?? 50;
  const height = init.height ?? 20;

  const base: Record<string, unknown> = {
    id,
    name: init.name,
    type: init.type,
    visible: init.visible ?? true,
    x,
    y,
    width,
    height,
    absoluteBoundingBox: { x, y, width, height },
  };

  if (init.type === "TEXT") base.characters = init.characters ?? "";
  if (init.fills) base.fills = init.fills;

  if (init.children) {
    const children = init.children;
    base.children = children;
    // Recursive findAll, mirroring Figma's descendant search.
    base.findAll = (predicate?: (n: SceneNode) => boolean): SceneNode[] => {
      const out: SceneNode[] = [];
      const walk = (n: SceneNode) => {
        if (!predicate || predicate(n)) out.push(n);
        const kids = (n as unknown as { children?: SceneNode[] }).children;
        if (kids) kids.forEach(walk);
      };
      children.forEach(walk);
      return out;
    };
  }

  return base as unknown as SceneNode;
}

beforeEach(() => {
  counter = 0;
  setGeneratorLocale("nb");
});

// ----------------------------------------------------------------------------
// classifyElement — signal priority
// ----------------------------------------------------------------------------

describe("classifyElement", () => {
  it("prefers an explicit vo-label-trait tag over everything", () => {
    const cls = classifyElement(node({ name: "vo-label-trait Back Button", type: "FRAME" }));
    expect(cls.source).toBe("tag");
    expect(cls.taggedLabel).toBe("Back");
    expect(cls.taggedTrait).toBe("Button");
    expect(cls.role).toBe("button");
  });

  it("classifies a plain text node as static text", () => {
    const cls = classifyElement(node({ name: "Label", type: "TEXT", characters: "Hi" }));
    expect(cls.role).toBe("text");
    expect(cls.source).toBe("text");
  });

  it("treats a text node named like a title as a heading", () => {
    const cls = classifyElement(node({ name: "Page Title", type: "TEXT", characters: "Welcome" }));
    expect(cls.role).toBe("heading");
  });

  it("uses the component name as a trusted signal", () => {
    const cls = classifyElement(node({ name: "Button/Primary", type: "INSTANCE" }));
    expect(cls.role).toBe("button");
    expect(cls.source).toBe("component");
  });

  it("matches the most specific role first (switch before button)", () => {
    expect(classifyElement(node({ name: "Toggle Switch", type: "FRAME" })).role).toBe("switch");
    expect(classifyElement(node({ name: "Checkbox row", type: "FRAME" })).role).toBe("checkbox");
  });

  it("falls back to image for vector-ish shapes", () => {
    expect(classifyElement(node({ name: "Frame 12", type: "VECTOR" })).role).toBe("image");
  });

  it("infers image from a visible image fill on an unstructured node", () => {
    const cls = classifyElement(
      node({ name: "Frame 31", type: "RECTANGLE", fills: [{ type: "IMAGE" }] })
    );
    expect(cls.role).toBe("image");
  });

  it("falls back to group for an unstructured container", () => {
    expect(classifyElement(node({ name: "Frame 99", type: "FRAME" })).role).toBe("group");
  });
});

// ----------------------------------------------------------------------------
// deriveLabel — one meaningful label, never all text joined
// ----------------------------------------------------------------------------

describe("deriveLabel", () => {
  it("returns the tag label when tagged", () => {
    expect(deriveLabel(node({ name: "vo-label-trait Submit Button", type: "FRAME" }))).toBe("Submit");
  });

  it("returns a text node's own characters", () => {
    expect(deriveLabel(node({ name: "x", type: "TEXT", characters: "  Hello  " }))).toBe("Hello");
  });

  it("uses the FIRST text in reading order, not every text joined", () => {
    const container = node({
      name: "Frame 4",
      type: "FRAME",
      children: [
        node({ name: "sub", type: "TEXT", characters: "Subtitle", y: 40 }),
        node({ name: "title", type: "TEXT", characters: "Title", y: 0 }),
      ],
    });
    expect(deriveLabel(container)).toBe("Title");
  });

  it("returns empty string for an auto-generated junk name with no text", () => {
    expect(deriveLabel(node({ name: "Frame 12", type: "FRAME", children: [] }))).toBe("");
  });
});

// ----------------------------------------------------------------------------
// buildFields — assembled output + locale-driven hints
// ----------------------------------------------------------------------------

describe("buildFields", () => {
  it("builds a Norwegian button hint by default", () => {
    const f = buildFields(node({ name: "Button", type: "INSTANCE", characters: "" , children: [node({ name: "t", type: "TEXT", characters: "Buy" })]}));
    expect(f.trait).toBe("Button");
    expect(f.role).toBe("button");
    expect(f.hintIOS).toContain("Dobbelttrykk");
    expect(f.hintIOS).toContain("Buy");
    expect(f.value).toBe("n/a");
  });

  it("emits English hints when the locale is switched", () => {
    setGeneratorLocale("en");
    const f = buildFields(node({ name: "Button", type: "INSTANCE" }));
    expect(f.hintIOS).toContain("Double-tap");
  });

  it("respects a per-call locale override", () => {
    const f = buildFields(node({ name: "Link", type: "FRAME" }), { locale: "en" });
    expect(f.hintIOS).toContain("Double-tap");
  });

  it("sets value to the label for textual roles and adds no hint", () => {
    const f = buildFields(node({ name: "x", type: "TEXT", characters: "Read me" }));
    expect(f.value).toBe("Read me");
    expect(f.hintIOS).toBe("");
  });

  it("gives images a trait but no hint", () => {
    const f = buildFields(node({ name: "icon-home", type: "FRAME" }));
    expect(f.trait).toBe("Image");
    expect(f.hintIOS).toBe("");
  });
});

// ----------------------------------------------------------------------------
// reading order + frame walk
// ----------------------------------------------------------------------------

describe("reading order", () => {
  it("orders top-to-bottom then left-to-right within a row", () => {
    const a = node({ name: "a", type: "TEXT", characters: "a", x: 100, y: 0 });
    const b = node({ name: "b", type: "TEXT", characters: "b", x: 0, y: 0 });
    const c = node({ name: "c", type: "TEXT", characters: "c", x: 0, y: 50 });
    const sorted = [a, c, b].sort(readingOrderComparator).map((n) => n.name);
    expect(sorted).toEqual(["b", "a", "c"]);
  });
});

describe("collectFocusableElements", () => {
  it("walks structural containers but emits concrete elements as single units", () => {
    const button = node({
      name: "Button/Primary",
      type: "INSTANCE",
      y: 100,
      children: [
        node({ name: "icon", type: "VECTOR" }),
        node({ name: "label", type: "TEXT", characters: "Save" }),
      ],
    });
    const heading = node({ name: "title", type: "TEXT", characters: "Settings", y: 0 });
    const card = node({
      name: "Frame 7", // structural → recurse
      type: "FRAME",
      children: [heading, button],
    });
    const frame = node({ name: "Screen", type: "FRAME", children: [card] }) as unknown as FrameNode;

    const result = collectFocusableElements(frame);
    // Heading first (y:0), then the button as a single unit — NOT its icon/label.
    expect(result.map((n) => n.name)).toEqual(["title", "Button/Primary"]);
  });

  it("skips hidden nodes and plugin scaffolding", () => {
    const frame = node({
      name: "Screen",
      type: "FRAME",
      children: [
        node({ name: "hidden btn", type: "INSTANCE", visible: false }),
        node({ name: "Annotation Table 1 - 123:4", type: "FRAME" }),
        node({ name: "visible label", type: "TEXT", characters: "Hi" }),
      ],
    }) as unknown as FrameNode;

    expect(collectFocusableElements(frame).map((n) => n.name)).toEqual(["visible label"]);
  });
});
