// ============================================================================
// TRANSACTION WRAPPER - Atomic operations for multi-step node creation
// ============================================================================
// Provides all-or-nothing semantics for canvas operations that involve
// multiple Figma API calls. Partially created nodes are cleaned up on failure.
// ============================================================================

import { Logger } from "./logger";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Plugin data key for identifying transaction drafts */
const TRANSACTION_DRAFT_KEY = "isTransactionDraft";

/** Plugin data key for tracking transaction start time */
const TRANSACTION_START_TIME_KEY = "transactionStartTime";

/** Prefix for draft nodes during construction */
const DRAFT_NAME_PREFIX = "⚠️ [BUILDING] ";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for creating a transaction
 */
export interface TransactionOptions {
  /** Name for the draft group (will be prefixed with DRAFT_NAME_PREFIX) */
  name: string;
  /** Parent node to append the draft group to */
  parentNode: BaseNode & ChildrenMixin;
}

/**
 * Context provided to transaction operations
 */
export interface TransactionContext {
  /** The draft group containing all nodes created during the transaction */
  draftGroup: FrameNode;
  /** Commit the transaction: make nodes visible and clean up metadata */
  commit: () => void;
  /** Abort the transaction: delete all created nodes */
  abort: () => void;
}

// ============================================================================
// TRANSACTION FUNCTIONS
// ============================================================================

/**
 * Begin a new transaction.
 * Creates an invisible draft group for atomic node operations.
 *
 * @param options - Transaction options including name and parent node
 * @returns Transaction context with draft group and commit/abort functions
 */
export function beginTransaction(
  options: TransactionOptions
): TransactionContext {
  const { name, parentNode } = options;

  // Create a frame as the draft container (groups don't support visibility)
  const draftFrame = figma.createFrame();
  draftFrame.name = `${DRAFT_NAME_PREFIX}${name}`;
  draftFrame.visible = false;
  draftFrame.fills = []; // Transparent background
  draftFrame.layoutMode = "NONE"; // No auto-layout constraints
  draftFrame.resize(1, 1); // Minimal initial size

  // CRITICAL: Position draft frame at origin (0, 0) to ensure child coordinates
  // remain correct when unboxed. Children use coordinates relative to their parent,
  // so if draft frame is at (0, 0) and child is at (500, 300), after unboxing
  // to page (also at origin), child will be at (500, 300).
  draftFrame.x = 0;
  draftFrame.y = 0;

  // Set plugin data for identification and cleanup
  draftFrame.setPluginData(TRANSACTION_DRAFT_KEY, "true");
  draftFrame.setPluginData(TRANSACTION_START_TIME_KEY, Date.now().toString());

  // Append to parent node
  parentNode.appendChild(draftFrame);

  Logger.debug("Transaction", "Started transaction", {
    name,
    draftId: draftFrame.id,
    parentId: parentNode.id,
  });

  // Track if transaction has been finalized
  let finalized = false;

  const commit = (): void => {
    if (finalized) {
      Logger.warn("Transaction", "Transaction already finalized", { name });
      return;
    }
    finalized = true;

    try {
      // Make the draft frame visible
      draftFrame.visible = true;

      // Remove draft prefix from name
      if (draftFrame.name.startsWith(DRAFT_NAME_PREFIX)) {
        draftFrame.name = draftFrame.name.slice(DRAFT_NAME_PREFIX.length);
      }

      // Clear transaction metadata
      draftFrame.setPluginData(TRANSACTION_DRAFT_KEY, "");
      draftFrame.setPluginData(TRANSACTION_START_TIME_KEY, "");

      // Ungroup: move children to parent and delete the frame
      // CRITICAL: Preserve absolute coordinates during reparenting
      // Child coordinates are relative to parent, so we must account for
      // any offset between the draft frame and the new parent
      const children = [...draftFrame.children];
      const parent = draftFrame.parent;

      if (parent && "appendChild" in parent) {
        // Get the index of the draft frame in the parent
        const frameIndex = parent.children.indexOf(draftFrame);

        // Calculate offset: draft frame position relative to parent
        // Since draft frame is at (0, 0) and parent (page) is also at origin,
        // offset is (0, 0) - but we calculate explicitly for robustness
        const draftOffsetX = draftFrame.x;
        const draftOffsetY = draftFrame.y;

        // Move each child to the parent at the correct position
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (!child) continue;
          // All children of FrameNode are SceneNodes with x/y properties
          if (!child.removed && "x" in child && "y" in child) {
            // Preserve the absolute position by adjusting for parent offset
            const absoluteX = child.x + draftOffsetX;
            const absoluteY = child.y + draftOffsetY;

            parent.insertChild(frameIndex + i, child);

            // Restore absolute position after reparenting
            child.x = absoluteX;
            child.y = absoluteY;
          } else if (!child.removed) {
            // For nodes without x/y (shouldn't happen, but defensive)
            parent.insertChild(frameIndex + i, child);
          }
        }
      }

      // Remove the now-empty draft frame
      if (!draftFrame.removed) {
        draftFrame.remove();
      }

      Logger.debug("Transaction", "Committed transaction", {
        name,
        childrenMoved: children.length,
      });
    } catch (error) {
      Logger.error("Transaction", "Error during commit", {
        name,
        error,
      });
      throw error;
    }
  };

  const abort = (): void => {
    if (finalized) {
      Logger.warn("Transaction", "Transaction already finalized", { name });
      return;
    }
    finalized = true;

    try {
      const childCount = draftFrame.children.length;

      // Delete the entire draft group (includes all children)
      if (!draftFrame.removed) {
        draftFrame.remove();
      }

      Logger.debug("Transaction", "Aborted transaction", {
        name,
        nodesDeleted: childCount + 1, // +1 for the frame itself
      });
    } catch (error) {
      Logger.error("Transaction", "Error during abort", {
        name,
        error,
      });
      // Don't re-throw during abort - best effort cleanup
    }
  };

  return {
    draftGroup: draftFrame,
    commit,
    abort,
  };
}

/**
 * Execute an operation within a transaction.
 * Automatically commits on success, aborts on failure.
 * 
 * @param options - Transaction options including name and parent node
 * @param operation - Async function to execute within the transaction
 * @returns Result of the operation
 * @throws Error from operation (after cleanup is complete)
 */
export async function withTransaction<T>(
  options: TransactionOptions,
  operation: (context: TransactionContext) => Promise<T>
): Promise<T> {
  const context = beginTransaction(options);

  try {
    const result = await operation(context);
    context.commit();
    return result;
  } catch (error) {
    // Ensure cleanup runs in finally-like manner
    try {
      context.abort();
    } catch (abortError) {
      Logger.error("Transaction", "Error during abort after operation failure", {
        name: options.name,
        originalError: error,
        abortError,
      });
    }

    // Log compensation
    Logger.warn("Transaction", "Operation failed, compensating", {
      name: options.name,
      error,
    });

    throw error;
  }
}

// ============================================================================
// GARBAGE COLLECTION
// ============================================================================

/**
 * Clean up orphaned transaction drafts from previous sessions.
 * Should be called during plugin initialization.
 * 
 * @returns Number of orphaned drafts cleaned up
 */
export function cleanupOrphanedDrafts(): number {
  try {
    // Find all nodes with transaction draft plugin data
    const orphanedDrafts = figma.currentPage.findAllWithCriteria({
      pluginData: { keys: [TRANSACTION_DRAFT_KEY] },
    });

    // Filter to only those with isTransactionDraft === "true"
    const draftsToClean = orphanedDrafts.filter(
      (node) => node.getPluginData(TRANSACTION_DRAFT_KEY) === "true"
    );

    // Delete each orphaned draft
    let cleanedCount = 0;
    for (const draft of draftsToClean) {
      if (!draft.removed) {
        const startTime = draft.getPluginData(TRANSACTION_START_TIME_KEY);
        Logger.debug("Transaction GC", "Cleaning orphaned draft", {
          name: draft.name,
          id: draft.id,
          startTime: startTime ? new Date(parseInt(startTime, 10)).toISOString() : "unknown",
        });
        draft.remove();
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      Logger.info("Transaction GC", `Cleaned up ${cleanedCount} orphaned draft(s) from previous session`);
    }

    return cleanedCount;
  } catch (error) {
    Logger.error("Transaction GC", "Error during orphan cleanup", { error });
    return 0;
  }
}

/**
 * Show notification to user if orphaned drafts were cleaned up.
 * 
 * @param cleanedCount - Number of drafts that were cleaned up
 */
export function notifyOrphanCleanup(cleanedCount: number): void {
  if (cleanedCount > 0) {
    figma.notify(
      `Cleaned up ${cleanedCount} incomplete operation${cleanedCount > 1 ? "s" : ""} from last session`,
      { timeout: 3000 }
    );
  }
}
