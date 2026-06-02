## MODIFIED Requirements

### Requirement: Safe Canvas Operations
The system SHALL handle canvas operation failures gracefully.

- All canvas reads/writes are wrapped in try-catch
- Fallback values are used when operations fail
- Errors are logged but do not crash the sync process
- **Circuit breaker pattern prevents repeated failures from cascading**
- **Per-operation circuit breakers allow granular degradation**

#### Scenario: Parse failure uses fallback
- **WHEN** parsing an annotation table fails
- **THEN** null is returned for that table
- **AND** sync continues with other tables
- **AND** error is logged

#### Scenario: Circuit breaker trips after repeated failures
- **WHEN** 3 consecutive failures occur within 5 seconds for the same operation
- **THEN** the circuit breaker for that operation trips to `OPEN` state
- **AND** subsequent calls to that operation are blocked
- **AND** `FIGMA_ERROR` is emitted to UI with cooldown duration

#### Scenario: Validation happens before circuit breaker check
- **WHEN** a message handler receives a payload
- **THEN** Valibot validation occurs first (invalid payloads are rejected immediately)
- **AND** circuit breaker check occurs only for valid payloads
- **AND** invalid payloads do not count toward circuit breaker failure threshold

#### Scenario: Circuit breaker allows recovery after cooldown
- **WHEN** 30 seconds have passed since circuit breaker tripped
- **THEN** the breaker moves to `HALF_OPEN` state
- **AND** next operation attempt is allowed
- **AND** success resets breaker to `CLOSED`
- **AND** failure re-trips breaker for another 30 seconds

#### Scenario: Independent breakers per operation
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker is open
- **AND** `cb_UPDATE_ANNOTATIONS` breaker is closed
- **THEN** insert operations are blocked
- **AND** update operations are allowed

## ADDED Requirements

### Requirement: Circuit Breaker Per-Operation Keying
The system SHALL maintain independent circuit breakers for each operation type.

- Breaker keys follow pattern: `cb_{MESSAGE_TYPE}`
- Each key tracks its own failure count and state
- Tripping one breaker does not affect others
- All breakers share the same configuration thresholds

#### Scenario: Insert breaker trips independently
- **WHEN** INSERT_ANNOTATIONS fails 3 times
- **THEN** `cb_INSERT_ANNOTATIONS` breaker trips
- **AND** `cb_UPDATE_ANNOTATIONS` remains closed
- **AND** users can still update existing tables

#### Scenario: Multiple breakers can be open
- **WHEN** both INSERT and UPDATE operations fail repeatedly
- **THEN** both `cb_INSERT_ANNOTATIONS` and `cb_UPDATE_ANNOTATIONS` are open
- **AND** UI shows both operations as temporarily unavailable

### Requirement: Circuit Breaker UI Feedback
The system SHALL notify users when circuit breakers affect functionality.

- `FIGMA_ERROR` message includes operation name and cooldown duration
- UI disables affected buttons during cooldown
- Warning banner shows countdown timer
- `FIGMA_ERROR_CLEARED` message re-enables UI

#### Scenario: UI shows warning when breaker trips
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker trips
- **THEN** UI receives `FIGMA_ERROR` with `{ operation: 'INSERT_ANNOTATIONS', cooldownMs: 30000 }`
- **AND** "Insert Annotations" button is disabled
- **AND** warning banner shows "Canvas insert paused. Retry in 30s"

#### Scenario: UI clears warning when breaker resets
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker resets after cooldown
- **THEN** UI receives `FIGMA_ERROR_CLEARED` with `{ operation: 'INSERT_ANNOTATIONS' }`
- **AND** "Insert Annotations" button is re-enabled
- **AND** warning banner is removed

### Requirement: Sliding Window Failure Tracking
The system SHALL track failures within a sliding time window.

- Failures are timestamped when recorded
- Only failures within the last 5 seconds count toward threshold
- Old failures are pruned before threshold check
- This prevents accumulating failures over long sessions

#### Scenario: Old failures don't count
- **WHEN** 2 failures occurred 10 seconds ago
- **AND** 1 failure occurs now
- **THEN** only 1 failure is within the window
- **AND** breaker does not trip (threshold is 3)

#### Scenario: Rapid failures trip breaker
- **WHEN** 3 failures occur within 2 seconds
- **THEN** all 3 are within the window
- **AND** breaker trips immediately
