import { loadFontsAsync } from "@create-figma-plugin/utilities";

// ============================================================================
// NODE FACTORY - Shared helper functions for creating Figma nodes
// ============================================================================
// Pure utility functions for creating table rows and cell text components.
// These functions are shared across platform-specific renderers to avoid
// duplication and dependency injection hell.
// ============================================================================

/**
 * Create a row frame with locked background and border
 * The background and border are locked so clicks pass through to the table frame
 * @param width - Row width (typically 528)
 * @param height - Row height (40 for data rows, 32 for header rows)
 * @param backgroundColor - Background color (white for data rows)
 * @param borderColor - Border color (gray for bottom border)
 * @returns Configured FrameNode with locked rectangles
 */
export function createRowWithLockedBackground(
  width: number,
  height: number,
  backgroundColor: { r: number; g: number; b: number },
  borderColor: { r: number; g: number; b: number }
): FrameNode {
  const row = figma.createFrame();
  row.layoutMode = "HORIZONTAL";
  row.primaryAxisSizingMode = "FIXED";
  row.counterAxisSizingMode = "FIXED"; // Fixed height for consistent row spacing
  row.primaryAxisAlignItems = "MIN"; // Left align horizontally
  row.counterAxisAlignItems = "CENTER"; // Center align vertically
  row.resize(width, height);
  row.paddingTop = 8;
  row.paddingBottom = 8;
  row.paddingLeft = 12;
  row.paddingRight = 12;
  row.itemSpacing = 8;

  // CRITICAL CHANGE 1: Make the container transparent
  row.fills = [];
  // Remove strokes from frame - we'll add border as a locked rectangle if needed
  row.strokes = [];

  // CRITICAL CHANGE 2: Add a locked background rectangle
  // Create this FIRST so it sits behind the content
  const bg = figma.createRectangle();
  bg.resize(width, height);
  // Background color for rows
  bg.fills = [{ type: "SOLID", color: backgroundColor }];
  // Scale with the row if the row resizes
  bg.constraints = { horizontal: "SCALE", vertical: "SCALE" };
  // LOCK ONLY THIS RECTANGLE - clicks pass through it
  bg.locked = true;

  // Append FIRST, then set absolute positioning (parent must have layoutMode set)
  row.appendChild(bg);
  // Set to Absolute so it doesn't mess up Auto Layout flow
  bg.layoutPositioning = "ABSOLUTE";
  bg.x = 0;
  bg.y = 0;

  // Add bottom border as a separate locked rectangle
  const border = figma.createRectangle();
  border.resize(width, 1);
  border.fills = [{ type: "SOLID", color: borderColor }];
  border.constraints = { horizontal: "SCALE", vertical: "MIN" };
  border.locked = true;

  // Append FIRST, then set absolute positioning
  row.appendChild(border);
  border.layoutPositioning = "ABSOLUTE";
  border.x = 0;
  border.y = height - 1; // Position at bottom

  return row;
}

/**
 * Create a cell text component
 * @param text - Text content
 * @param width - Cell width
 * @param bold - Whether text should be bold
 * @returns FrameNode container with text node
 */
export async function createCellText(
  text: string,
  width: number,
  bold: boolean = false
): Promise<FrameNode> {
  const textNode = figma.createText();
  textNode.characters = text;
  textNode.fontSize = 12;
  textNode.fontName = { family: "Inter", style: bold ? "Bold" : "Regular" };

  // Load fonts before setting font properties (matches badge renderer pattern)
  await loadFontsAsync([textNode]);
  textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

  // TEXT WRAPPING FIX
  textNode.textAutoResize = "HEIGHT";
  textNode.resize(width - 16, 20);
  textNode.textAlignVertical = "CENTER"; // Center align vertically
  textNode.textAlignHorizontal = "LEFT"; // Explicitly left align

  const container = figma.createFrame();
  container.layoutMode = "VERTICAL";
  container.primaryAxisSizingMode = "AUTO"; // Grow with content!
  container.counterAxisSizingMode = "FIXED";
  container.counterAxisAlignItems = "MIN"; // Left align horizontally
  container.primaryAxisAlignItems = "CENTER"; // Center align vertically
  container.resize(width, 24); // Match header cell height for consistency
  container.paddingLeft = 8;
  container.paddingRight = 8;
  container.paddingTop = 4;
  container.paddingBottom = 4;
  container.fills = [];

  container.appendChild(textNode);
  return container;
}
