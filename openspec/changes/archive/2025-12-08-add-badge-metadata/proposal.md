# Add Badge Metadata Storage

> [!IMPORTANT] > **Partially Superseded:** The `replace-groups-with-frames` change (archived 2025-12-08) already implemented `elementId` storage in `BadgeMetadata`. This proposal's remaining scope is limited to adding `sourceFrameId` for consistency with other canvas elements.

## Why

Canvas elements have inconsistent frameId storage patterns:

| Element   | Plugin Data                          | Name Encoding                          |
| --------- | ------------------------------------ | -------------------------------------- |
| Container | ✅ `ContainerMetadata.sourceFrameId` | ✅ `Annotation Container - {frameId}`  |
| Table     | ✅ `TableMetadata.sourceFrameId`     | ✅ `Annotation Table {id} - {frameId}` |
| **Badge** | ⚠️ `elementId` only                  | ✅ `Annotation Badge {id} - {frameId}` |

Badges now store `elementId` via plugin data (implemented in `replace-groups-with-frames`), but lack `sourceFrameId` for consistency with tables and containers.

## What Changes

### 1. Badge Metadata Storage (Partial - Remaining Work)

- ~~Add `BadgeMetadata` interface~~ ✅ Already exists with `elementId`
- Add `sourceFrameId` to `BadgeMetadata` matching `ContainerMetadata` and `TableMetadata` patterns
- Store badge metadata (sourceFrameId, annotationId, version, timestamp) via `setPluginData()`
- Support reading metadata for badge lookups (with name fallback for legacy badges)

## Impact

### Specs Modified

- `canvas-rendering` (Create Annotation Badge requirement)

### Systems Affected

| Component          | Change                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| `types.ts`         | Add `sourceFrameId` to existing `BadgeMetadata` interface              |
| `canvas-badge.ts`  | Update `storeBadgeMetadata()` to include `sourceFrameId`               |
| `canvas-parser.ts` | Can optionally use metadata for badge lookup (name fallback preserved) |

---

## Backwards Compatibility

Legacy badges without metadata continue to work:

- Name-based lookup (`Annotation Badge {id} - {frameId}`) remains the fallback
- Metadata is additive, not required for existing badges
- Self-healing: future operations can populate metadata on legacy badges
