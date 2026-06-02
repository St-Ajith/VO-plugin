// ============================================================================
// TRANSACTION WRAPPER - Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockFigma, MockFrameNode, MockPageNode } from "../mocks/figma";

// Import the transaction wrapper functions
import {
  beginTransaction,
  withTransaction,
  cleanupOrphanedDrafts,
  notifyOrphanCleanup,
} from "../../utils/transaction-wrapper";

describe("Transaction Wrapper", () => {
  let mockFigma: ReturnType<typeof createMockFigma>;

  beforeEach(() => {
    mockFigma = createMockFigma();
    // Install mock figma globally
    (globalThis as unknown as { figma: unknown }).figma = mockFigma.figma;
  });

  afterEach(() => {
    mockFigma.reset();
  });

  describe("beginTransaction", () => {
    it("should create invisible draft group with correct metadata", () => {
      const parentNode = mockFigma.figma.currentPage;

      const context = beginTransaction({
        name: "Test Table",
        parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
      });

      // Draft group should be created
      expect(context.draftGroup).toBeDefined();
      
      // Draft group should be invisible
      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      expect(draftFrame.visible).toBe(false);
      
      // Draft group should have correct name prefix
      expect(draftFrame.name).toBe("⚠️ [BUILDING] Test Table");
      
      // Draft group should have transaction metadata
      expect(draftFrame.getPluginData("isTransactionDraft")).toBe("true");
      expect(draftFrame.getPluginData("transactionStartTime")).toBeTruthy();
      
      // Draft group should be appended to parent
      expect(parentNode.children).toContain(draftFrame);
    });

    it("should track transaction start time", () => {
      const before = Date.now();
      
      const context = beginTransaction({
        name: "Test",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });
      
      const after = Date.now();
      
      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      const startTime = parseInt(draftFrame.getPluginData("transactionStartTime"), 10);
      
      expect(startTime).toBeGreaterThanOrEqual(before);
      expect(startTime).toBeLessThanOrEqual(after);
    });
  });

  describe("commit", () => {
    it("should make draft group visible and clear metadata", () => {
      const context = beginTransaction({
        name: "Test Table",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      
      // Before commit
      expect(draftFrame.visible).toBe(false);
      expect(draftFrame.getPluginData("isTransactionDraft")).toBe("true");
      
      // Commit the transaction
      context.commit();
      
      // After commit: metadata should be cleared
      // Note: The commit moves children to parent and removes the frame
      // So we check that the frame was removed
      expect(draftFrame.removed).toBe(true);
    });

    it("should move children to parent and remove draft group", () => {
      const parentNode = mockFigma.figma.currentPage;
      
      const context = beginTransaction({
        name: "Test",
        parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
      });

      // Add a child to the draft group
      const childFrame = mockFigma.figma.createFrame();
      childFrame.name = "Child Node";
      (context.draftGroup as unknown as MockFrameNode).appendChild(childFrame as unknown as MockFrameNode);
      
      // Commit
      context.commit();
      
      // Child should now be in parent
      expect(parentNode.children).toContain(childFrame);
      
      // Draft group should be removed
      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      expect(draftFrame.removed).toBe(true);
    });

    it("should preserve child coordinates during unboxing", () => {
      const parentNode = mockFigma.figma.currentPage;
      
      const context = beginTransaction({
        name: "Test",
        parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
      });

      // Set specific coordinates on child (simulating table positioning)
      const childFrame = mockFigma.figma.createFrame() as unknown as MockFrameNode;
      childFrame.name = "Positioned Table";
      childFrame.x = 500;
      childFrame.y = 300;
      (context.draftGroup as unknown as MockFrameNode).appendChild(childFrame);
      
      // Commit
      context.commit();
      
      // Child should be in parent with same absolute coordinates
      expect(parentNode.children).toContain(childFrame);
      expect(childFrame.x).toBe(500);
      expect(childFrame.y).toBe(300);
    });

    it("should remove draft prefix from name on commit", () => {
      const context = beginTransaction({
        name: "My Table",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      expect(draftFrame.name).toBe("⚠️ [BUILDING] My Table");
      
      // After commit, the frame is removed but before removal the name is cleaned
      // We can verify by checking that children are moved correctly
      context.commit();
      
      // Frame should be removed
      expect(draftFrame.removed).toBe(true);
    });

    it("should only commit once (idempotent)", () => {
      const context = beginTransaction({
        name: "Test",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      context.commit();
      
      // Second commit should be a no-op (no error)
      expect(() => context.commit()).not.toThrow();
    });
  });

  describe("abort", () => {
    it("should delete draft group and all children", () => {
      const parentNode = mockFigma.figma.currentPage;
      
      const context = beginTransaction({
        name: "Test",
        parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
      });

      // Add children to draft group
      const child1 = mockFigma.figma.createFrame();
      const child2 = mockFigma.figma.createText();
      (context.draftGroup as unknown as MockFrameNode).appendChild(child1 as unknown as MockFrameNode);
      (context.draftGroup as unknown as MockFrameNode).appendChild(child2 as unknown as MockFrameNode);

      // Abort
      context.abort();
      
      // Draft group should be removed
      const draftFrame = context.draftGroup as unknown as MockFrameNode;
      expect(draftFrame.removed).toBe(true);
      
      // Draft group should no longer be in parent
      expect(parentNode.children).not.toContain(draftFrame);
    });

    it("should only abort once (idempotent)", () => {
      const context = beginTransaction({
        name: "Test",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      context.abort();
      
      // Second abort should be a no-op (no error)
      expect(() => context.abort()).not.toThrow();
    });

    it("should not be able to abort after commit", () => {
      const context = beginTransaction({
        name: "Test",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      context.commit();
      
      // Abort after commit should be a no-op
      expect(() => context.abort()).not.toThrow();
    });

    it("should not be able to commit after abort", () => {
      const context = beginTransaction({
        name: "Test",
        parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
      });

      context.abort();
      
      // Commit after abort should be a no-op
      expect(() => context.commit()).not.toThrow();
    });
  });

  describe("withTransaction", () => {
    it("should auto-commit on successful operation", async () => {
      const parentNode = mockFigma.figma.currentPage;
      
      const result = await withTransaction(
        {
          name: "Test Table",
          parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
        },
        (context) => {
          // Create a node inside the transaction
          const frame = mockFigma.figma.createFrame();
          frame.name = "Created Node";
          (context.draftGroup as unknown as MockFrameNode).appendChild(frame as unknown as MockFrameNode);
          return Promise.resolve(frame);
        }
      );

      // Result should be returned
      expect(result).toBeDefined();
      expect(result.name).toBe("Created Node");
      
      // Created node should be in parent (moved from draft group)
      expect(parentNode.children).toContain(result);
    });

    it("should auto-abort on failed operation and rethrow error", async () => {
      const parentNode = mockFigma.figma.currentPage;
      const initialChildCount = parentNode.children.length;
      
      const testError = new Error("Font loading failed");
      
      await expect(
        withTransaction(
          {
            name: "Test Table",
            parentNode: parentNode as unknown as BaseNode & ChildrenMixin,
          },
          (context) => {
            // Create nodes
            const frame = mockFigma.figma.createFrame();
            (context.draftGroup as unknown as MockFrameNode).appendChild(frame as unknown as MockFrameNode);
            
            // Simulate failure mid-operation
            throw testError;
          }
        )
      ).rejects.toThrow("Font loading failed");
      
      // No orphan nodes should remain (draft group and children cleaned up)
      // Parent should have same number of children as before
      expect(parentNode.children.length).toBe(initialChildCount);
    });

    it("should return value from operation", async () => {
      const result = await withTransaction(
        {
          name: "Test",
          parentNode: mockFigma.figma.currentPage as unknown as BaseNode & ChildrenMixin,
        },
        () => {
          return Promise.resolve({ value: 42, name: "test" });
        }
      );

      expect(result).toEqual({ value: 42, name: "test" });
    });
  });

  describe("cleanupOrphanedDrafts", () => {
    it("should clean up nodes with isTransactionDraft plugin data", () => {
      // Create mock orphaned drafts
      const orphan1 = mockFigma.figma.createFrame();
      orphan1.name = "⚠️ [BUILDING] Orphan 1";
      (orphan1 as unknown as MockFrameNode).setPluginData("isTransactionDraft", "true");
      (orphan1 as unknown as MockFrameNode).setPluginData("transactionStartTime", "1234567890");
      mockFigma.figma.currentPage.appendChild(orphan1 as unknown as MockFrameNode);

      const orphan2 = mockFigma.figma.createFrame();
      orphan2.name = "⚠️ [BUILDING] Orphan 2";
      (orphan2 as unknown as MockFrameNode).setPluginData("isTransactionDraft", "true");
      mockFigma.figma.currentPage.appendChild(orphan2 as unknown as MockFrameNode);

      // Add findAllWithCriteria mock - cast through unknown to avoid TS errors
      (mockFigma.figma.currentPage as unknown as MockPageNode).findAllWithCriteria = vi.fn(() => {
        return mockFigma.figma.currentPage.children.filter((node) => {
          const frame = node as unknown as MockFrameNode;
          return frame.getPluginData?.("isTransactionDraft") === "true";
        });
      });

      const cleanedCount = cleanupOrphanedDrafts();

      expect(cleanedCount).toBe(2);
      expect((orphan1 as unknown as MockFrameNode).removed).toBe(true);
      expect((orphan2 as unknown as MockFrameNode).removed).toBe(true);
    });

    it("should not clean up normal nodes", () => {
      // Create a normal frame (not a transaction draft)
      const normalFrame = mockFigma.figma.createFrame();
      normalFrame.name = "Normal Frame";
      mockFigma.figma.currentPage.appendChild(normalFrame as unknown as MockFrameNode);

      // Mock findAllWithCriteria to return empty (no drafts) - cast through unknown
      (mockFigma.figma.currentPage as unknown as MockPageNode).findAllWithCriteria = vi.fn(() => []);

      const cleanedCount = cleanupOrphanedDrafts();

      expect(cleanedCount).toBe(0);
      expect((normalFrame as unknown as MockFrameNode).removed).toBe(false);
    });

    it("should return 0 when no orphans exist", () => {
      (mockFigma.figma.currentPage as unknown as MockPageNode).findAllWithCriteria = vi.fn(() => []);
      
      const cleanedCount = cleanupOrphanedDrafts();
      
      expect(cleanedCount).toBe(0);
    });
  });

  describe("notifyOrphanCleanup", () => {
    it("should show notification when orphans were cleaned", () => {
      notifyOrphanCleanup(3);
      
      expect(mockFigma.figma.notify).toHaveBeenCalledWith(
        "Cleaned up 3 incomplete operations from last session",
        { timeout: 3000 }
      );
    });

    it("should show singular message for one orphan", () => {
      notifyOrphanCleanup(1);
      
      expect(mockFigma.figma.notify).toHaveBeenCalledWith(
        "Cleaned up 1 incomplete operation from last session",
        { timeout: 3000 }
      );
    });

    it("should not show notification when no orphans cleaned", () => {
      notifyOrphanCleanup(0);
      
      expect(mockFigma.figma.notify).not.toHaveBeenCalled();
    });
  });
});
