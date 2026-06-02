## ADDED Requirements

### Requirement: Command Queue Serialization
The system SHALL serialize state-mutating operations through an async command queue to prevent race conditions.

- Mutating operations (CREATE, UPDATE, DELETE, REORDER, INSERT, save-data, delete-data) enter the queue
- Read operations (GET_SCREENS, SELECT_FRAME, SYNC_CANVAS) bypass the queue for responsiveness
- Queue processes commands in FIFO order
- Each command completes (success or failure) before the next begins
- Async gaps within handlers (e.g., `loadFontAsync`) do not allow interleaving

#### Scenario: Concurrent create operations are serialized
- **WHEN** two CREATE_ANNOTATION messages arrive within 10ms
- **THEN** the first is fully processed (including node save) before the second begins
- **AND** each receives a unique sequential ID
- **AND** no duplicate IDs are created

#### Scenario: Read operation bypasses queue
- **WHEN** GET_SCREENS is received while a CREATE_ANNOTATION is processing
- **THEN** GET_SCREENS executes immediately
- **AND** the response is sent without waiting for CREATE to complete

#### Scenario: Queue handles handler errors
- **WHEN** a queued command's handler throws an error
- **THEN** the error is caught and logged
- **AND** the queue continues processing remaining commands
- **AND** the failed command's promise is rejected

### Requirement: Internal Mutation Flag
The system SHALL suppress self-triggered `documentchange` events during command queue processing.

- `isInternalMutation` flag is set to `true` before command execution
- `isInternalMutation` flag is set to `false` after command completion (in `finally` block)
- `NodeChangeCoordinator` checks this flag and skips processing when `true`
- Flag is reset even if handler throws an error

#### Scenario: Internal mutation skips nodechange handling
- **WHEN** `INSERT_ANNOTATIONS` creates table nodes
- **AND** Figma emits `documentchange` events for those nodes
- **THEN** `NodeChangeCoordinator` detects `isInternalMutation === true`
- **AND** the events are logged but not processed
- **AND** no redundant sync cycles occur

#### Scenario: Flag resets on error
- **WHEN** a command handler throws an error
- **THEN** `isInternalMutation` is reset to `false` in the `finally` block
- **AND** subsequent external `documentchange` events are processed normally
