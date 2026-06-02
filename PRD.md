Product requirements document: Accessibility annotation plugin
Plugin Name: Accessibility annotation suite for Figma
Owner: Ajith Kumar
Note: The name is broadened to "Suite" to align with the future goal of adding other annotation modules.

1. 🎯 Overview & Goal
   1.1. Problem Statement
   Design-to-development handoff for accessibility (a11y) is broken. Designers lack a standardized, in-tool method to specify dynamic behaviors like focus order, screen reader labels, and component roles. This forces developers to guess, leading to manual re-work, inconsistent user experiences, and products that fail WCAG compliance.
   1.2. Product Goal
   To develop a best-in-class Figma plugin that streamlines the accessibility related documentation for dev handoff process.
   1.3. Mission (V1)
   Enable designers to create, manage, and visualize a11y annotations (VoiceOver, TalkBack, ARIA) directly in Figma. The plugin will provide intelligent defaults based on WCAG standards and render clean, developer-ready documentation on the canvas, inspired by the UX of tools like SealData.

DeP2. 👥 Target Personas
UI/UX Designer (Primary): Needs to document a11y requirements without leaving Figma. Wants a fast, intuitive workflow.
Front-End Developer (Secondary): Needs to read the designer's annotations and translate them into code (ARIA markup, React Native props, etc.). Values clarity, accuracy, and completeness.
Accessibility Specialist / QA: Needs to review the design for compliance before development begins.

3. 🐛 Immediate Fixes (Technical Debt)
   This section addresses all items marked "Need fix" in the draft. These are P0/P1 bugs that compromise existing functionality.
   P0: Stability - Frame detection logic
   Issue: The plugin intermittently fails to detect all frames on the page.
   Requirement: Refactor the frame detection function (figma.currentPage.findAll(n => n.type === "FRAME")) to be more robust. It should reliably find all top-level frames, regardless of their naming convention.
   P1: Performance - Multi-element annotation
   Issue: The plugin UI freezes or experiences significant lag when loading or annotating multiple elements (est. 20+).
   Requirement: Profile plugin performance. Implement lazy loading for the annotation list in the UI. Optimize data processing, perhaps by batching updates to the Figma file's clientStorage.
   P1: Data Integrity - Annotation reordering
   Issue: Arrow based re-order annotations in the plugin list does not update the numerical indicators on the plugin.
   Requirement: Ensure the data model (e.g., an array of annotation objects) is the single source of truth. When the array is re-indexed, this change must trigger a re-render of the canvas annotations to update their text (VO-annotation-1, VO-annotation-2, etc.).
   P2: Rendering - Canvas annotation formatting
   Issue: Annotations inserted onto the canvas are poorly formatted, with text overflow, clipping, or hidden layers.
   Requirement: The annotation "box" must be a stable Figma component or group. All text layers within it must be set to "Auto-height" or "Auto-width" to prevent clipping. Ensure all layers are visible by default (.visible = true).

4. 🚀 Functional Requirements (Epics & Features)
   These are new features and enhancements, prioritized from the "Immediate actions" list.
   Epic 1: Smart frame & Context management
   As a designer, I need the plugin to be context-aware so I can work efficiently on one screen at a time.
   Feature: Dynamic frame detection & filtering
   User story: "As a designer, I want the plugin to automatically identify which frames are 'screens' (vs. components). When I select a 'screen' frame on the canvas, the plugin UI should instantly filter to show only the annotations for that screen."

Or

“This plugin should automatically go though all pages/screens and in one click it should automatically create annotations”
Technical spec:
Frame identification: Implement a setting where users can define an identifier (e.g., a "-screen" suffix, as suggested). The plugin will use this rule to filter relevant frames.
Contextual filtering: Listen to the figma.on("selectionchange") event. If the new selection is a frame matching the identifier, update the plugin's UI state to display data associated with that frame.id.

Epic 2: High-fidelity annotation visualization
As a developer, I need to clearly understand which annotation belongs to which element and in what order.
Feature: Dynamic Focus Order & Reordering
User Story: "As a designer, I must be able to define the tab/swipe order. I want to drag-and-drop annotations in the plugin list, and see the numbers on the canvas update immediately to reflect the new order."
Technical Spec:
This is linked to the "Data Integrity" bug fix.
The annotation object in the data model must have a focusOrder (or index) property.
When a user re-orders the list, the focusOrder properties for all items in that frame are updated.
A render function is called to find and update the text (.characters) of each corresponding annotation box on the canvas.

Feature: Clean annotation rendering & naming
User story: "When I 'Insert Annotations,' I need them placed neatly on the canvas without overlapping. Each annotation box should have a unique, traceable name."
Technical spec:
Naming convention: When rendering, name the annotation group: [A11Y]-Annotation-(${focusOrder}). Example: [A11Y]-Annotation-(1).
Positioning algorithm: Implement a basic collision avoidance algorithm. When placing an annotation box, check its bounding box against all other annotation boxes for that frame. If an overlap occurs, "nudge" the new box (e.g., 20px down) until no overlap is detected.

Feature: Leader Line Connectors (Inspired by https://www.getseal.co/)
User Story: "As a developer, I want to see a clear pointer or line connecting the annotation box to its specific UI element, so there is no ambiguity."
Technical Spec:
Use the figma.createLine() API.
Store the node.id of the target element and the node.id of the annotation box.
Draw a line from the absoluteBoundingBox of the target to the absoluteBoundingBox of the annotation.
Group the line with the annotation box.
(Advanced) Add event listeners to redraw the line if either the target element or the annotation box is moved.

Epic 3: Intelligent Data Capture
As a designer, I want the plugin to help me follow standards, not just give me empty fields.
Feature: WCAG-Aware Property Population
User Story: "When I select a common element, like a button or text field, I want the plugin to intelligently pre-fill the a11y fields based on WCAG standards."
Technical Spec:
Element Detection: On element selection, inspect its node.name, node.type, or componentProperties.
Rules Engine (Examples):
If (node.name contains "button" OR node.componentProperties.role === "button"), pre-fill:
Platform (Mobile): Role = "Button"
Platform (Web): Role = <button>
If (node.name contains "input" or "textfield"), pre-fill:
Role = "Text Field"
Label: Attempt to find an adjacent text node to use as the label.
If (node.type is "TEXT"), pre-fill:
Label = node.characters

Feature: Platform-Specific Fields (Web/ARIA)
User Story: "When I'm annotating for a web platform, I need more fields than for mobile. I need to be able to specify ARIA roles and properties."
Technical Spec:
In the plugin UI, when the user selects Platform: Web, conditionally display new input fields for:
ARIA Role (e.g., navigation, search)
aria-label
aria-describedby
aria-hidden ("true"/"false")

5. 🛠️ Non-functional requirements (NFRs)
   Performance:
   Plugin load time: < 2 seconds.
   UI interactions (editing text, reordering) must be real-time (< 100ms lag).
   Canvas annotation rendering (for a complex screen with 50+ annotations) must complete in < 5 seconds.
   Compatibility: Must be fully functional on Figma Desktop App (Windows, macOS) and Figma in the browser (Chrome, Firefox, Safari).
   Data persistence: All annotation data must be stored locally within the Figma file (e.g., using figma.clientStorage or custom data on nodes). The file must be the single source of truth. No external database dependency for V1.
   Security (for future): When/if payment and profiles are added, all user data (auth tokens, payment info) must be handled by a secure, separate backend (e.g., Supabase, Firebase Auth) and must not be stored in the Figma file.

6. 🗺️ Future considerations (V2+ Roadmap)
   This section captures future goals from the draft.
   V2.0: Dev handoff & collaboration
   Dev mode integration: Create a view in Figma's Dev Mode to display a11y data as code snippets (inspired by Figma to Code plugin).
   Collaboration: Allow users to @-mention teammates in annotations and "resolve" comments.
   V2.1: Audit & Automation
   Automated testing: Integrate an accessibility testing library (like axe-core) to run simple checks (e.g., color contrast, tap target size) directly in the plugin.
   Export: Export all annotations for a frame to a CSV or JSON accessibility audit report.
   V3.0: Commercialization & Platform
   Profiles & Subscriptions: Introduce Pro/Team plans for advanced features.
   Expanded Modules: Add other annotation types beyond a11y (e.g., "Specs" panel inspired by DesignDoc [Spectral]).
