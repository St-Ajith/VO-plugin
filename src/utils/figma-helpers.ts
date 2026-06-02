// ============================================================================
// FIGMA HELPERS - Figma API utility functions
// ============================================================================

import { Logger } from "./logger";

/**
 * Check if a node is an annotation table
 */
export function isAnnotationTable(node: SceneNode): boolean {
  // Check name pattern first (fast check)
  if (!node.name.startsWith("Annotation Table")) {
    return false;
  }

  // If it's a Frame node, also check plugin data for confirmation
  if (node.type === "FRAME") {
    // Simple check - full metadata reading is in canvas service
    return node.name.match(/^Annotation Table \d+ - .+/) !== null;
  }

  return false;
}

/**
 * Detect the top-level frame containing a node
 */
export function detectTopLevelFrame(
  node: SceneNode
): { id: string; name: string; pageId: string; pageName: string } | null {
  let current: BaseNode | null = node;

  while (current && current.parent) {
    if (
      (current.type === "FRAME" || current.type === "SECTION") &&
      current.parent.type === "PAGE"
    ) {
      // Exclude annotation tables and containers from being detected as valid frames
      if (isAnnotationTable(current as SceneNode)) {
        // Continue searching up the tree for the actual parent frame
        current = current.parent;
        continue;
      }
      if (current.name.startsWith("Annotation Container")) {
        // Continue searching up the tree for the actual parent frame
        current = current.parent;
        continue;
      }

      Logger.debug("Frame detected", "Valid frame found", {
        name: current.name,
      });
      return {
        id: current.id,
        name: current.name,
        pageId: current.parent.id,
        pageName: current.parent.name,
      };
    }
    current = current.parent;
  }

  Logger.warn("Frame detect", "Not in top-level frame");
  return null;
}

/**
 * Get all top-level frames from the current page
 * Note: figma.currentPage.children is safe to access without async operations
 * per Figma's dynamic-page documentation
 */
export function getAllTopLevelFrames(): { id: string; name: string }[] {
  const frames: { id: string; name: string }[] = [];

  // figma.currentPage is always available and its children can be accessed directly
  figma.currentPage.children.forEach((node) => {
    // Exclude annotation tables, containers, and internal scaffolding frames from frame selector
    // Internal frames created during table construction are named exactly "Frame"
    if (
      (node.type === "FRAME" || node.type === "SECTION") &&
      !node.name.startsWith("Annotation Table") &&
      !node.name.startsWith("Annotation Container") &&
      node.name !== "Frame" // Exclude internal scaffolding frames
    ) {
      frames.push({
        id: node.id,
        name: `${node.name} (${figma.currentPage.name})`,
      });
    }
  });

  frames.sort((a, b) => a.name.localeCompare(b.name));
  Logger.info("Frames", "Found", { count: frames.length });

  return frames;
}

/**
 * Get all top-level frames from all pages in the document
 */
export async function getAllDocumentFrames(): Promise<
  { id: string; name: string; pageName: string }[]
> {
  const frames: { id: string; name: string; pageName: string }[] = [];

  // Load all pages for document-wide search (required for dynamic-page access)
  await figma.loadAllPagesAsync();

  // After loadAllPagesAsync(), all pages are loaded and we can safely access page.children
  for (const page of figma.root.children) {
    if (page.type === "PAGE") {
      // page.children is safe to access after loadAllPagesAsync()
      page.children.forEach((node) => {
        // Exclude annotation tables, containers, and internal scaffolding frames from frame selector
        // Internal frames created during table construction are named exactly "Frame"
        if (
          (node.type === "FRAME" || node.type === "SECTION") &&
          !node.name.startsWith("Annotation Table") &&
          !node.name.startsWith("Annotation Container") &&
          node.name !== "Frame" // Exclude internal scaffolding frames
        ) {
          frames.push({
            id: node.id,
            name: node.name,
            pageName: page.name,
          });
        }
      });
    }
  }

  frames.sort((a, b) => {
    // Sort by page name first, then by frame name
    const pageCompare = a.pageName.localeCompare(b.pageName);
    return pageCompare !== 0 ? pageCompare : a.name.localeCompare(b.name);
  });

  Logger.info("Document frames", "Found", { count: frames.length });
  return frames;
}

/**
 * Find an element by ID (wrapper around figma.getNodeByIdAsync)
 */
export async function findElementById(
  nodeId: string
): Promise<SceneNode | null> {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || node.removed) {
      return null;
    }
    return node as SceneNode;
  } catch (error) {
    Logger.debug("Figma helpers", "Node not found", { nodeId, error });
    return null;
  }
}

/**
 * Get the path to a node (page name > frame name > ... > node name)
 */
export function getNodePath(node: SceneNode): string {
  const path: string[] = [];
  let current: BaseNode | null = node;

  while (current) {
    if (current.type === "PAGE") {
      path.unshift(`Page: ${current.name}`);
      break;
    }
    path.unshift(current.name);
    current = current.parent;
  }

  return path.join(" > ");
}

/**
 * Parse tagged element name to extract label and trait
 * Naming convention: "vo-label-trait {label} {trait}"
 * Example: "vo-label-trait Back Button" => { label: "Back", trait: "Button" }
 * 
 * @param name - Element layer name
 * @returns Parsed label and trait, or null if name doesn't match pattern
 */
export function parseTaggedName(name: string): { label: string; trait: string } | null {
  // Check if name starts with the vo-label-trait prefix
  const prefix = "vo-label-trait ";
  if (!name.startsWith(prefix)) {
    return null;
  }

  // Extract the content after the prefix
  const content = name.substring(prefix.length).trim();
  if (!content) {
    return null;
  }

  // Split by space and parse as {label} {trait}
  // Handle cases where label might have multiple words
  const parts = content.split(/\s+/);
  if (parts.length < 2) {
    // If only one word, use it as both label and trait
    const [firstPart] = parts;
    const label = firstPart ?? content;
    return { label, trait: label };
  }

  // Last word is the trait, everything else is the label
  const trait = parts[parts.length - 1];
  if (trait === undefined) {
    return { label: content, trait: content };
  }
  const label = parts.slice(0, -1).join(" ");

  return { label, trait };
}

/**
 * Find all elements in a frame with the vo-label-trait naming convention
 * 
 * @param frame - Frame node to search in
 * @returns Array of scene nodes that match the naming convention
 */
export function findTaggedElements(frame: FrameNode | SectionNode): SceneNode[] {
  const taggedElements: SceneNode[] = [];

  // Search all descendants of the frame for elements with vo-label-trait prefix
  // findAll already returns SceneNode types, no need to filter by node type
  const allNodes = frame.findAll((node) => {
    return node.name.startsWith("vo-label-trait ");
  });

  // Filter out annotation tables
  for (const node of allNodes) {
    if (isAnnotationTable(node)) {
      continue; // Skip annotation tables
    }
    taggedElements.push(node);
  }

  Logger.debug("Tagged elements", "Found tagged elements in frame", {
    frameName: frame.name,
    count: taggedElements.length,
  });

  return taggedElements;
}

