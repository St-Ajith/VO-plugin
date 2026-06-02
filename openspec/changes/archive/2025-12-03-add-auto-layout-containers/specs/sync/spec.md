# Sync - Spec Delta

## MODIFIED Requirements

### Requirement: Canvas Table Discovery
The system SHALL efficiently discover annotation tables across all pages.

- **Uses container-based lookup when available (O(1) per frame)**
- **Falls back to page scanning for legacy tables without containers**
- Cache TTL: 5 seconds
- Filters tables by name pattern: "Annotation Table*"
- Excludes hidden tables (`visible !== false`)
- Handles page scan failures gracefully (continues with other pages)

#### Scenario: Find tables via container lookup
- **WHEN** canvas sync is triggered for a frame
- **AND** an annotation container exists for that frame
- **THEN** tables are retrieved directly from container's table column
- **AND** no page-wide scan is needed

#### Scenario: Find tables on current page
- **WHEN** canvas sync is triggered
- **AND** no container exists (legacy mode)
- **THEN** all annotation tables on the current page are found via name pattern
- **AND** results are cached for 5 seconds

#### Scenario: Cache hit avoids re-scan
- **WHEN** sync is triggered within 5 seconds of last scan
- **THEN** cached table list is returned
- **AND** no page scan occurs

#### Scenario: Page scan failure is isolated
- **WHEN** scanning one page fails (e.g., permission error)
- **THEN** other pages are still scanned
- **AND** a warning is logged for the failed page

### Requirement: Track Annotations with Tables
The system SHALL track which annotations have canvas tables.

- `checkCanvasSync()` returns array of annotation IDs with tables
- **Container mode: Extracts IDs from container's table column children names**
- **Legacy mode: Scans page for tables matching name pattern**
- Used to determine which annotations need table creation
- Enables "Insert Annotations" to create only missing tables

#### Scenario: Identify annotations via container
- **WHEN** container exists with tables for IDs [1, 3, 5]
- **AND** cache has annotations [1, 2, 3, 4, 5]
- **THEN** annotations 2 and 4 are identified as needing tables
- **AND** container lookup is O(1) per frame

#### Scenario: Identify annotations without tables
- **WHEN** sync returns IDs [1, 3, 5] as having tables
- **AND** cache has annotations [1, 2, 3, 4, 5]
- **THEN** annotations 2 and 4 are identified as needing tables

## ADDED Requirements

### Requirement: Container-Aware Sync
The system SHALL use annotation containers for efficient sync operations when available.

- Container lookup by name: `Annotation Container - {frameId}`
- Direct child traversal instead of page-wide scans
- Automatic frame position tracking via container metadata
- Single position update moves all artifacts when frame moves

#### Scenario: Sync container position with frame
- **WHEN** a frame moves
- **AND** sync detects position mismatch (>10px)
- **THEN** the container is repositioned to frame's right edge + 60px
- **AND** all child badges and tables move automatically

#### Scenario: Fast table lookup via container
- **WHEN** sync needs to find tables for a specific frame
- **THEN** container is found by name in O(1)
- **AND** tables are retrieved from table column's children
- **AND** no full page scan is required

#### Scenario: Container metadata provides frame mapping
- **WHEN** sync needs to determine which frame owns a table
- **THEN** container metadata `sourceFrameId` is read
- **AND** all children inherit the same frame ownership
