// ============================================================================
// NODE VALIDATION UTILITIES - Comprehensive node state checking
// ============================================================================

import {
  isLocked,
  isVisible,
  isWithinInstanceNode,
} from "@create-figma-plugin/utilities";
import { isAnnotationTable } from "./figma-helpers";

// Validate if a node is suitable for annotation operations
export function validateNodeForAnnotation(node: SceneNode): {
  isValid: boolean;
  reason?: string;
} {
  // Check if node exists and is not removed
  if (node.removed) {
    return { isValid: false, reason: "Node has been removed" };
  }

  // Reject annotation tables - they are not valid elements to annotate
  if (isAnnotationTable(node)) {
    return {
      isValid: false,
      reason:
        "Cannot annotate annotation tables. Please select an element within a frame.",
    };
  }

  // Check if node is visible
  if (!isVisible(node)) {
    return { isValid: false, reason: "Node is not visible" };
  }

  // Check if node is locked (prevents editing)
  if (isLocked(node)) {
    return { isValid: false, reason: "Node is locked" };
  }

  // Check if node is within an instance (component instance)
  if (isWithinInstanceNode(node)) {
    return { isValid: false, reason: "Node is within a component instance" };
  }

  // Check supported node types
  const supportedTypes = [
    "FRAME",
    "GROUP",
    "RECTANGLE",
    "ELLIPSE",
    "POLYGON",
    "STAR",
    "VECTOR",
    "TEXT",
    "COMPONENT",
    "INSTANCE",
    "SECTION",
  ];
  if (!supportedTypes.includes(node.type)) {
    return { isValid: false, reason: `Unsupported node type: ${node.type}` };
  }

  return { isValid: true };
}

// Enhanced node existence check with comprehensive validation
export async function validateNodeExists(nodeId: string): Promise<{
  exists: boolean;
  node?: SceneNode;
  reason?: string;
}> {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);

    if (!node) {
      return { exists: false, reason: "Node not found" };
    }

    if (node.removed) {
      return { exists: false, reason: "Node has been removed" };
    }

    const validation = validateNodeForAnnotation(node as SceneNode);
    if (!validation.isValid) {
      return {
        exists: false,
        ...(validation.reason && { reason: validation.reason }),
      };
    }

    return { exists: true, node: node as SceneNode };
  } catch (_error) {
    return { exists: false, reason: "Node not found" };
  }
}

