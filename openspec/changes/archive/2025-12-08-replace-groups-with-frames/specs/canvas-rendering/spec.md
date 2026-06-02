# Canvas Rendering Spec Delta

## ADDED Requirements

### Requirement: Replace Groups with Frames

**Description:** Badges MUST be constructed using `FrameNode` with transparent backgrounds (FrameGroups) instead of `GroupNode`.
**Reason:** Groups are deprecated for this usage; Frames offer better control.

#### Scenario: Creating a new badge

- **Given** a user adds an annotation
- **When** the badge is rendered on canvas
- **Then** the resulting node type is `FRAME`
- **And** it contains the badge rectangle and text
- **And** the badge metadata includes `elementId`

#### Scenario: Reading existing badges

- **Given** a canvas with mixed old (Group) and new (Frame) badges
- **When** the plugin parses the canvas
- **Then** it SHOULD detect both types for backward compatibility

### Requirement: Badge Metadata Must Include Element ID

**Description:** Badge plugin data (`voice_over_annotations_badgeMetadata`) MUST include `elementId` field.
**Reason:** This enables robust element resolution when badges are placed inside annotation containers (separate from the source frame), where geometry-based lookup fails.

#### Scenario: Parsing a badge inside a container

- **Given** a badge exists inside an "Annotation Container" frame
- **When** the parser attempts to resolve the associated element
- **Then** it reads `elementId` from the badge's plugin data
- **And** uses that ID to locate the element node

#### Scenario: Self-healing badge metadata

- **Given** an existing badge without `elementId` in its metadata
- **When** `updateBadge` is called
- **Then** it writes the target's `id` into the badge metadata
- **And** future parses can resolve the element without geometry lookup
