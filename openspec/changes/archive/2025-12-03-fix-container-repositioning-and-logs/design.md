# Design: Fix Container Repositioning and Log Clarity

## Context
The `add-auto-layout-containers` change introduced container repositioning, but only implemented it in the INSERT flow (`handleInsertAnnotationsBatched`). The UPDATE flow (`handleUpdateAnnotations`) doesn't check for container existence or reposition containers when frames move.

Additionally, log messages use inconsistent scopes ("Batch insert", "Update annotation", "Sync canvas") making it difficult to understand which operation is running and what container operations are happening.

## Goals
- Container repositioning works consistently in both INSERT and UPDATE flows
- Log messages clearly indicate operation type (Insert/Update/Sync) and container operations
- Container operations (create/reposition/cleanup) are logged with operation context

## Non-Goals
- Changing the container repositioning threshold (10px) or logic
- Modifying container structure or auto-layout behavior
- Changing when INSERT vs UPDATE is triggered (UI logic)

## Decisions

### Decision 1: Add Container Management to UPDATE Flow
**What**: Call `getOrCreateContainer()` and `positionContainerRelativeToFrame()` in `handleUpdateAnnotations()`.

**Why**: 
- UPDATE should maintain container positioning just like INSERT
- Users expect containers to follow frames regardless of which operation they trigger
- Consistent behavior reduces confusion

**Implementation**:
- Add container get/create after frame validation (same pattern as INSERT)
- Call repositioning with same 10px threshold logic
- Log container operations with "Update annotations" scope

### Decision 2: Standardize Log Scopes
**What**: Use consistent scope names: "Insert annotations", "Update annotations", "Sync canvas".

**Why**:
- Makes logs searchable and filterable
- Clearly indicates which operation is running
- Matches user-facing terminology

**Changes**:
- "Batch insert" → "Insert annotations"
- "Update annotation" → "Update annotations" (plural for consistency)
- Keep "Sync canvas" as-is

### Decision 3: Log Container Operations with Context
**What**: Container operation logs should include operation context (Insert/Update).

**Why**:
- Helps debug which flow triggered container operations
- Makes it clear when repositioning happens during UPDATE vs INSERT
- Improves traceability

**Implementation**:
- Container creation/repositioning logs already exist in `canvas.ts`
- Add wrapper logs in message-router with operation context
- Keep existing detailed logs in canvas service

## Risks / Trade-offs

### Risk: UPDATE Flow Performance
**Risk**: Adding container operations to UPDATE might slow it down.

**Mitigation**: 
- Container lookup is O(1) (findOne by name)
- Repositioning only happens if frame moved >10px (same threshold as INSERT)
- Performance impact is minimal

### Trade-off: Log Verbosity
**Trade-off**: More logs = more noise, but better debugging.

**Acceptance**: 
- Debug logs are filtered by scope in practice
- Better debugging outweighs slight verbosity increase
- Can be adjusted if needed

## Migration Plan
No migration needed - this is a bug fix and logging improvement. Existing containers continue to work, they just get repositioned correctly during UPDATE operations.

