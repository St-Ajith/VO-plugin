# Canvas Rendering - Spec Delta

## MODIFIED Requirements

### Requirement: Create Annotation Badge

The system SHALL create a numbered badge on the target element.

- Badge is a rounded rectangle with the annotation ID number
- **Badge X position is calculated relative to the root frame's right edge** (8px gap)
- **Badge Y position depends on whether the target is a sub-element or the frame itself**
- When target is a sub-element: badge is **vertically centered** on the element
- **When target is the frame itself: badges are stacked vertically from the frame's top edge**
- Badge uses gray background (#6B7379) with white text
- Badge is grouped with a background for layering

#### Scenario: Create badge for sub-element annotation
- **WHEN** "Insert Annotations" is triggered for an annotation targeting a sub-element
- **THEN** a badge with the annotation number appears at the frame's right edge + 8px
- **AND** the badge is vertically centered on the sub-element's height
- **AND** the badge is named "Annotation Badge {id} - {frameId}"

#### Scenario: Create badge for frame-level annotation
- **WHEN** "Insert Annotations" is triggered for an annotation where target equals frame
- **THEN** a badge with the annotation number appears at the frame's right edge + 8px
- **AND** the badge Y position is `frame.y + (annotationIndex * 32)`
- **AND** multiple frame-level badges are stacked vertically without overlap

#### Scenario: Badge position avoids frame overlap
- **WHEN** an annotation is created for an element near the frame's right edge
- **THEN** the badge is placed outside the frame boundary (at frame's right edge + 8px)
- **AND** the badge does not overlap the frame border
