// ============================================================================
// FIGMA MOCK INFRASTRUCTURE - Integration testing utilities
// ============================================================================

import { vi } from "vitest";

/**
 * MockNode - Base class for all node types
 * Implements plugin data storage and common node properties
 */
export class MockNode {
  id: string;
  name: string;
  type: NodeType;
  removed = false;
  parent: MockNode | null = null;
  private pluginData = new Map<string, string>();

  constructor(id: string, name: string, type: NodeType) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  setPluginData(key: string, value: string): void {
    if (this.removed) {
      throw new Error(`Cannot set plugin data on removed node ${this.id}`);
    }
    this.pluginData.set(key, value);
  }

  getPluginData(key: string): string {
    if (this.removed) {
      return "";
    }
    return this.pluginData.get(key) ?? "";
  }

  getAllPluginData(): Record<string, string> {
    const result: Record<string, string> = {};
    this.pluginData.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  remove(): void {
    this.removed = true;
    // Remove from parent's children array
    if (this.parent && "children" in this.parent) {
      const parent = this.parent as { children: MockNode[] };
      const index = parent.children.indexOf(this);
      if (index > -1) {
        parent.children.splice(index, 1);
      }
    }
  }
}

/**
 * MockFrameNode - Frame node with children support and auto-layout
 */
export class MockFrameNode extends MockNode {
  children: MockNode[] = [];
  x = 0;
  y = 0;
  width = 100;
  height = 100;
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL" = "NONE";
  layoutPositioning: "AUTO" | "ABSOLUTE" = "AUTO";
  itemSpacing = 0;
  primaryAxisSizingMode: "FIXED" | "AUTO" = "FIXED";
  counterAxisSizingMode: "FIXED" | "AUTO" = "FIXED";
  primaryAxisAlignItems: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN" = "MIN";
  counterAxisAlignItems: "MIN" | "MAX" | "CENTER" | "BASELINE" = "MIN";
  paddingLeft = 0;
  paddingRight = 0;
  paddingTop = 0;
  paddingBottom = 0;
  fills: Paint[] = [];
  cornerRadius = 0;
  strokeWeight = 0;
  strokes: Paint[] = [];
  visible = true;
  constraints = { horizontal: "MIN" as const, vertical: "MIN" as const };
  locked = false;

  constructor(id: string, name: string) {
    super(id, name, "FRAME");
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  appendChild(child: MockNode): void {
    this.children.push(child);
    child.parent = this;
  }

  insertChild(index: number, child: MockNode): void {
    this.children.splice(index, 0, child);
    child.parent = this;
  }

  findAll(predicate?: (node: MockNode) => boolean): MockNode[] {
    if (!predicate) {
      return [...this.children];
    }
    return this.children.filter(predicate);
  }

  findOne(predicate: (node: MockNode) => boolean): MockNode | null {
    return this.children.find(predicate) ?? null;
  }

  findAllWithCriteria(_criteria: { pluginData?: { keys: string[] } }): MockNode[] {
    // Default implementation returns empty array
    // Tests should override this method when needed
    return [];
  }
}

/**
 * MockTextNode - Text node with character styling
 */
export class MockTextNode extends MockNode {
  characters = "";
  fontSize = 12;
  fontName = { family: "Inter", style: "Regular" };
  fills: Paint[] = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  x = 0;
  y = 0;
  width = 100;
  height = 20;
  textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED" = "LEFT";
  textAlignVertical: "TOP" | "CENTER" | "BOTTOM" = "TOP";

  constructor(id: string, name: string) {
    super(id, name, "TEXT");
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

/**
 * MockRectangleNode - Rectangle node with fill support
 */
export class MockRectangleNode extends MockNode {
  fills: Paint[] = [];
  x = 0;
  y = 0;
  width = 100;
  height = 100;
  cornerRadius = 0;
  constraints = { horizontal: "MIN" as const, vertical: "MIN" as const };
  locked = false;

  constructor(id: string, name: string) {
    super(id, name, "RECTANGLE");
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }
}

/**
 * MockGroupNode - Group node with children support
 */
export class MockGroupNode extends MockNode {
  children: MockNode[] = [];
  x = 0;
  y = 0;
  width = 100;
  height = 100;

  constructor(id: string, name: string) {
    super(id, name, "GROUP");
  }

  appendChild(child: MockNode): void {
    this.children.push(child);
    child.parent = this;
  }

  insertChild(index: number, child: MockNode): void {
    this.children.splice(index, 0, child);
    child.parent = this;
  }
}

/**
 * MockPageNode - Page node with children
 */
export class MockPageNode extends MockNode {
  children: MockNode[] = [];
  selection: MockNode[] = [];

  constructor(id: string, name: string) {
    super(id, name, "PAGE");
  }

  appendChild(child: MockNode): void {
    this.children.push(child);
    child.parent = this;
  }

  insertChild(index: number, child: MockNode): void {
    this.children.splice(index, 0, child);
    child.parent = this;
  }

  findAll(predicate?: (node: MockNode) => boolean): MockNode[] {
    if (!predicate) {
      return [...this.children];
    }
    return this.children.filter(predicate);
  }

  findOne(predicate: (node: MockNode) => boolean): MockNode | null {
    return this.children.find(predicate) ?? null;
  }

  findAllWithCriteria(_criteria: { pluginData?: { keys: string[] } }): MockNode[] {
    // Default implementation returns empty array
    // Tests should override this method when needed
    return [];
  }
}

/**
 * MockDocumentNode - Root document node
 */
export class MockDocumentNode extends MockNode {
  children: MockPageNode[] = [];

  constructor() {
    super("0:0", "Document", "DOCUMENT");
  }

  appendChild(child: MockPageNode): void {
    this.children.push(child);
    child.parent = this;
  }
}

/**
 * Call tracking for verification in tests
 */
interface CallRecord {
  method: string;
  args: unknown[];
  timestamp: number;
}

/**
 * createMockFigma - Factory for creating isolated Figma mock instances
 * Each test should create its own instance to ensure isolation
 */
export function createMockFigma() {
  const nodes = new Map<string, MockNode>();
  const calls: CallRecord[] = [];
  const notifications: string[] = [];
  
  // Create a default page
  const defaultPage = new MockPageNode("page-1", "Page 1");
  nodes.set(defaultPage.id, defaultPage);

  // Create root document (mutable so reset can reassign)
  let root = new MockDocumentNode();
  root.appendChild(defaultPage);
  nodes.set(root.id, root);

  /**
   * Track method calls for verification
   */
  function trackCall(method: string, ...args: unknown[]): void {
    calls.push({
      method,
      args,
      timestamp: Date.now(),
    });
  }

  /**
   * Mock Figma API object
   */
  const figma = {
    // Node operations
    getNodeByIdAsync: vi.fn(async (id: string) => {
      trackCall("getNodeByIdAsync", id);
      await Promise.resolve(); // Make it actually async
      return nodes.get(id) ?? null;
    }),

    // Page operations
    currentPage: defaultPage,

    loadAllPagesAsync: vi.fn(async () => {
      trackCall("loadAllPagesAsync");
      return Promise.resolve();
    }),

    // Root document
    root: root as unknown as DocumentNode,

    // Notifications
    notify: vi.fn((message: string) => {
      trackCall("notify", message);
      notifications.push(message);
    }),

    // Node creation
    createFrame: vi.fn(() => {
      trackCall("createFrame");
      const frame = new MockFrameNode(
        `frame-${nodes.size}`,
        `Frame ${nodes.size}`
      );
      nodes.set(frame.id, frame);
      return frame as unknown as FrameNode;
    }),

    createText: vi.fn(() => {
      trackCall("createText");
      const text = new MockTextNode(`text-${nodes.size}`, `Text ${nodes.size}`);
      nodes.set(text.id, text);
      return text as unknown as TextNode;
    }),

    createRectangle: vi.fn(() => {
      trackCall("createRectangle");
      const rect = new MockRectangleNode(
        `rect-${nodes.size}`,
        `Rectangle ${nodes.size}`
      );
      nodes.set(rect.id, rect);
      return rect as unknown as RectangleNode;
    }),

    group: vi.fn((children: MockNode[], _parent: MockPageNode) => {
      trackCall("group");
      const group = new MockGroupNode(
        `group-${nodes.size}`,
        `Group ${nodes.size}`
      );
      for (const child of children) {
        group.appendChild(child);
      }
      nodes.set(group.id, group);
      return group as unknown as GroupNode;
    }),

    // Font loading
    loadFontAsync: vi.fn(async (_font: FontName) => {
      trackCall("loadFontAsync");
      return Promise.resolve();
    }),

    // Client storage
    clientStorage: {
      getAsync: vi.fn(async () => {
        trackCall("clientStorage.getAsync");
        await Promise.resolve(); // Make it actually async
        return undefined;
      }),
      setAsync: vi.fn(async () => {
        trackCall("clientStorage.setAsync");
        await Promise.resolve(); // Make it actually async
        return Promise.resolve();
      }),
      deleteAsync: vi.fn(async () => {
        trackCall("clientStorage.deleteAsync");
        await Promise.resolve(); // Make it actually async
        return Promise.resolve();
      }),
    },

    // Viewport
    viewport: {
      scrollAndZoomIntoView: vi.fn(() => {
        trackCall("viewport.scrollAndZoomIntoView");
      }),
    },

    // UI (for message passing tests)
    ui: {
      postMessage: vi.fn((message) => {
        trackCall("ui.postMessage", message);
      }),
      on: vi.fn(() => {
        trackCall("ui.on");
      }),
      off: vi.fn(() => {
        trackCall("ui.off");
      }),
    },
  };

  /**
   * Test utilities
   */
  return {
    figma,
    
    // Node management
    addNode: (node: MockNode) => {
      nodes.set(node.id, node);
    },
    
    getNode: (id: string) => {
      return nodes.get(id);
    },
    
    removeNode: (id: string) => {
      const node = nodes.get(id);
      if (node) {
        node.remove();
      }
    },

    // Page management
    createPage: (id: string, name: string) => {
      const page = new MockPageNode(id, name);
      nodes.set(page.id, page);
      root.appendChild(page);
      return page;
    },

    setCurrentPage: (page: MockPageNode) => {
      figma.currentPage = page;
    },

    // Call tracking
    getCalls: () => [...calls],
    
    getCallsByMethod: (method: string) => {
      return calls.filter((c) => c.method === method);
    },
    
    wasMethodCalled: (method: string) => {
      return calls.some((c) => c.method === method);
    },

    // Notifications
    getNotifications: () => [...notifications],
    
    clearNotifications: () => {
      notifications.length = 0;
    },

    // Reset for test isolation
    reset: () => {
      nodes.clear();
      calls.length = 0;
      notifications.length = 0;
      
      // Recreate default page
      const newPage = new MockPageNode("page-1", "Page 1");
      nodes.set(newPage.id, newPage);
      figma.currentPage = newPage;

      // Recreate root and reassign both the closed-over variable and figma.root
      root = new MockDocumentNode();
      root.appendChild(newPage);
      nodes.set(root.id, root);
      figma.root = root as unknown as DocumentNode;

      // Reset all vi.fn() mocks
      vi.clearAllMocks();
    },
  };
}

/**
 * Type alias for the mock instance
 */
export type MockFigmaInstance = ReturnType<typeof createMockFigma>;
