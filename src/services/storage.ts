// ============================================================================
// STORAGE SERVICE - Node-based plugin data storage operations
// ============================================================================

import { Annotation, NodePluginData } from "../types";
import { Logger } from "../utils/logger";

export class StorageService {
  private readonly NAMESPACE = "voice_over_annotations";

  /**
   * Load annotation data from a specific Figma node
   */
  async loadFromNode(nodeId: string): Promise<Annotation | null> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.removed) {
        Logger.debug("Node storage", "Node has been removed", { nodeId });
        return null;
      }

      const pluginDataStr = node.getPluginData(this.NAMESPACE);
      if (!pluginDataStr) {
        return null;
      }

      const pluginData = JSON.parse(pluginDataStr) as NodePluginData;
      return pluginData.annotation || null;
    } catch (error) {
      Logger.error("Node storage", "Failed to load from node", {
        nodeId,
        error,
      });
      return null;
    }
  }

  /**
   * Save annotation data to a specific Figma node (authoritative source)
   */
  async saveToNode(nodeId: string, annotation: Annotation): Promise<void> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.removed) {
        throw new Error(`Node ${nodeId} has been removed`);
      }

      const pluginData: NodePluginData = {
        annotation: annotation,
        timestamp: Date.now(),
      };

      node.setPluginData(this.NAMESPACE, JSON.stringify(pluginData));
      Logger.debug("Node storage", "Saved annotation to node", {
        nodeId,
        annotationId: annotation.id,
      });
    } catch (error) {
      Logger.error("Node storage", error, {
        nodeId,
        annotationId: annotation.id,
      });
      throw error;
    }
  }

  /**
   * Remove annotation data from a Figma node
   */
  async removeFromNode(nodeId: string): Promise<void> {
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.removed) {
        Logger.debug(
          "Node storage",
          "Node has been removed, cannot remove data",
          { nodeId }
        );
        return;
      }

      node.setPluginData(this.NAMESPACE, "");
      Logger.debug("Node storage", "Removed annotation from node", { nodeId });
    } catch (error) {
      Logger.error("Node storage", "Failed to remove from node", {
        nodeId,
        error,
      });
    }
  }

  /**
   * Load all annotations from all Figma nodes (authoritative source)
   */
  async loadAllAnnotations(): Promise<Annotation[]> {
    try {
      // Find all nodes that might have annotation data
      // Load all pages first (required for dynamic-page access)
      await figma.loadAllPagesAsync();

      const annotations: Annotation[] = [];

      // Find all nodes with annotation data using findAll (efficient for this use case)
      // After loadAllPagesAsync(), all pages are loaded and we can safely access page.children
      for (const page of figma.root.children) {
        if (page.type === "PAGE") {
          // Find all nodes with our plugin data
          // page.findAll() is safe after loadAllPagesAsync()
          const nodesWithData = page.findAll((node) => {
            try {
              return node.getPluginData(this.NAMESPACE) !== "";
            } catch {
              return false;
            }
          });

          Logger.debug("Node storage", `Page "${page.name}" has ${nodesWithData.length} nodes with plugin data`, {
            pageId: page.id,
            pageName: page.name,
            nodeCount: nodesWithData.length,
          });

          for (const node of nodesWithData) {
            const annotation = await this.loadFromNode(node.id);
            if (annotation) {
              annotations.push(annotation);
              Logger.debug("Node storage", "Loaded annotation", {
                compositeKey: `${annotation.frameId}:${annotation.id}`,
                elementId: annotation.elementId,
                frameName: annotation.frameName,
              });
            }
          }
        }
      }

      Logger.info("Node storage", "Loaded annotations from nodes", {
        count: annotations.length,
        annotationKeys: annotations.map(a => `${a.frameId}:${a.id}`),
      });

      return annotations;
    } catch (error) {
      Logger.error("Node storage", "Failed to load from all nodes", error);
      throw error;
    }
  }

  /**
   * Save all annotations to their respective nodes
   * Note: This is a convenience method that saves each annotation individually
   */
  async saveAllAnnotations(annotations: Annotation[]): Promise<void> {
    const errors: Array<{ annotationId: number; error: unknown }> = [];

    for (const annotation of annotations) {
      try {
        await this.saveToNode(annotation.elementId, annotation);
      } catch (error) {
        errors.push({ annotationId: annotation.id, error });
        Logger.warn("Node storage", "Failed to save annotation", {
          annotationId: annotation.id,
          elementId: annotation.elementId,
          error,
        });
      }
    }

    if (errors.length > 0) {
      Logger.warn("Node storage", "Some annotations failed to save", {
        failedCount: errors.length,
        totalCount: annotations.length,
      });
    }

    Logger.info("Node storage", "Saved all annotations", {
      count: annotations.length,
      failedCount: errors.length,
    });
  }
}
