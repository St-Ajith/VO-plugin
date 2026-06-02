# Project Context

## Purpose

**VO Annotations** (Voice Over Annotations) is a Figma plugin that enables designers to create, manage, and visualize accessibility annotations directly in Figma designs. It supports:

- **Mobile platforms**: iOS VoiceOver and Android TalkBack
- **Web platform**: ARIA (Accessible Rich Internet Applications)

The plugin creates visual representations of accessibility data (tables, badges, leader lines) that can be shared with developers and stakeholders, improving the design-to-development handoff for WCAG compliance.

**Target users**: UI/UX Designers (primary), Front-End Developers (secondary), Accessibility Specialists/QA.

## Tech Stack

### Core Technologies
- **TypeScript** (>=5) - Primary language with strict mode enabled
- **Preact** (>=10) - Lightweight React alternative for UI
- **Preact Signals** (@preact/signals ^2.5.1) - Reactive state management

### Figma Plugin Framework
- **@create-figma-plugin/ui** (^4.0.3) - Figma-native UI component library
- **@create-figma-plugin/utilities** (^4.0.3) - Plugin utilities (emit, on, showUI)
- **build-figma-plugin** (^4.0.3) - Build CLI with TypeScript and minification

### Development Tools
- **ESLint** (>=9.39.1) with `@simenb/eslint-plugin-figma` for Figma-specific rules
- **TypeScript** (>=5) with `@create-figma-plugin/tsconfig` base config

### Build Commands
```bash
npm run build        # Build with typecheck + minify
npm run build:debug  # Build with typecheck (no minify)
npm run watch        # Watch mode with typecheck
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint issues
```

## Project Conventions

### Code Style

**TypeScript Patterns:**
- Strict mode enabled (`strict: true` in tsconfig)
- Always use `async/await` for Figma API calls
- Type all function parameters and return values
- Use interfaces for data structures (avoid `any`)
- Prefer `null` over `undefined` for optional values

**Naming Conventions:**
- **Files**: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- **Signals**: `camelCase` (e.g., `annotations`, `currentFrameId`)
- **Handlers**: `handle` prefix (e.g., `handleAnnotationCreate`)
- **Services**: `PascalCase` class names (e.g., `AnnotationStore`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `NAMESPACE`)

**Error Handling:**
```typescript
// Use structured Logger (src/utils/logger.ts)
Logger.error("Context", error, { data })
Logger.warn("Context", "message", data)
Logger.info("Context", "message", data)
Logger.debug("Context", "message", data)

// Graceful failures - return null, don't throw
try {
  const node = await figma.getNodeByIdAsync(nodeId)
  if (!node || node.removed) return null
} catch (error) {
  Logger.error("Node access", error)
  return null
}
```

**Preact Signals Patterns:**
```typescript
// ✅ Immutable updates (never mutate .value directly)
annotations.value = annotations.value.map(a =>
  a.id === id ? { ...a, ...updates } : a
)

// ✅ Direct signal in JSX (optimal reactivity)
return <p>Count: {annotations}</p>

// ✅ Batch multiple updates
batch(() => {
  annotations.value = newAnnotations
  hasChangedSinceInsert.value = true
})
```

**Code Organization:**
```typescript
// Use section headers in large files
// ============================================================================
// SECTION NAME - Description
// ============================================================================

// Constants at class/module top
class AnnotationStore {
  private readonly NAMESPACE = "voice_over_annotations"
  private readonly SYNC_DEBOUNCE_MS = 2000
}
```

### Architecture Patterns

**Two-Context Architecture:**

Figma plugins run in two separate JavaScript contexts:

1. **Plugin Context** (`src/main.ts`)
   - Runs in Figma's sandbox with access to Figma API
   - Handles data persistence via `node.setPluginData()`
   - Creates/manages canvas elements (tables, badges, lines)
   - Listens to Figma events (`nodechange`, `selectionchange`)
   - Communicates with UI via `figma.ui.postMessage()` / `emit()`

2. **UI Context** (`src/ui.tsx`)
   - Runs in an iframe with DOM access
   - Renders the plugin interface with Preact
   - Manages reactive UI state with Preact Signals
   - Communicates with plugin via `parent.postMessage()` / `on()` handlers

**Message-Based Communication:**
```
UI Context (ui.tsx)          Plugin Context (main.ts)
     │                              │
     │  emit('MESSAGE_NAME', data)  │
     ├─────────────────────────────>│
     │                              │ MessageRouter handles
     │  on('RESPONSE_NAME', data)   │
     │<─────────────────────────────┤
     │  Update Signals              │
```

**Service Layer Organization:**
| Service | Purpose |
|---------|---------|
| `AnnotationStore` | Core CRUD operations, node storage delegation |
| `MessageRouter` | Routes UI-to-plugin messages, handles all message types |
| `SyncCoordinator` | Bidirectional sync, conflict resolution |
| `NodeChangeCoordinator` | Figma `nodechange` event handling |
| `FrameManager` | Frame selection, state management |
| `CanvasService` | Canvas element creation (tables, badges) |

**File Structure:**
```
src/
├── main.ts              # Plugin entry point
├── ui.tsx               # UI entry point
├── store.ts             # Preact Signals state management
├── types.ts             # TypeScript type definitions
├── services/            # Business logic services
├── hooks/               # Preact hooks for UI operations
├── ui/components/       # Preact UI components
├── utils/               # Shared utilities
└── schema/              # Data schemas and field definitions
```

### Testing Strategy

**Current approach**: Manual testing (no automated test framework configured).

**Manual Test Categories** (see `TESTING.md`):
1. Frame Selection & Navigation
2. Create/Edit/Delete Annotations
3. Platform Switching (Mobile/Web)
4. Reorder Annotations
5. Insert into Figma Canvas
6. Toggle Visibility
7. Persistence Across Sessions
8. Edge Cases (no frames, multi-select, etc.)

**Debugging:**
- Use `Logger` utility for structured console output
- Figma console: **Plugins** → **Development** → **Show/Hide Console**

### Git Workflow

**Branching**: Feature branches off main, merge via PR.

**Commit style**: Conventional commits recommended:
- `feat:` new features
- `fix:` bug fixes
- `refactor:` code restructuring
- `docs:` documentation updates
- `chore:` build/tooling changes

## Domain Context

### Key Terminology

| Term | Description |
|------|-------------|
| **Annotation** | Accessibility metadata attached to a Figma element |
| **Frame** | Top-level Figma frame representing a screen/artboard |
| **Platform** | Mobile (iOS VoiceOver / Android TalkBack) or Web (ARIA) |
| **Canvas Elements** | Visual tables and badges created in Figma to display annotations |
| **Badge** | Numbered indicator placed next to annotated elements on canvas |
| **Leader Line** | Visual connector between badge and annotation table |

### Core Data Structure

```typescript
interface Annotation {
  id: number
  frameId: string
  frameName: string
  pageId: string
  pageName: string
  platform: "mobile" | "web"
  elementId: string
  elementName: string
  voicedPreview: string
  createdAt: number
  updatedAt: number
  mobile?: {
    ios: { label, value, trait, hint }
    android: { label, value, trait, hint }
  }
  web?: {
    ariaLabel, role, ariaDescribedBy, tabIndex
  }
}
```

### Storage Architecture

1. **Node Plugin Data** (Authoritative Source)
   - `node.setPluginData(NAMESPACE, JSON.stringify(annotations))`
   - Single source of truth, persists in Figma file

2. **Client Storage Cache** (Performance)
   - `figma.clientStorage` - disposable cache for faster loading
   - Never authoritative, rebuilt from node data

3. **Preact Signals** (Reactive UI State)
   - Ephemeral, resets on plugin restart
   - Synced from node data on init

### Sync Mechanisms

- **Bidirectional sync** between UI signals, node storage, and canvas elements
- **Timestamp-based conflict resolution** (latest wins)
- **Debounced saves** (2000ms) to reduce Figma API calls
- **Circuit breaker** pattern for failure prevention

## Important Constraints

### Figma Sandbox Limitations
- Plugin context has **no DOM access**
- UI context has **no Figma API access**
- All communication is **async via postMessage**
- No direct function calls between contexts

### Dynamic Page Loading (Required)
```json
// manifest.json
{ "documentAccess": "dynamic-page" }
```
All Figma API calls must be async:
```typescript
const node = await figma.getNodeByIdAsync(nodeId)
await page.loadAsync()
await figma.loadAllPagesAsync()
```

### Data Persistence (V1)
- All annotation data stored **locally within the Figma file**
- No external database dependency
- File is the single source of truth

### Platform Compatibility
- Figma Desktop App (Windows, macOS)
- Figma in browser (Chrome, Firefox, Safari)

### Performance Targets
- Plugin load time: < 2 seconds
- UI interactions: < 100ms lag
- Canvas rendering (50+ annotations): < 5 seconds

## External Dependencies

**V1**: No external services. All data persisted in Figma file.

**Planned V2+** (see PRD.md):
- Authentication backend (Supabase or Firebase Auth)
- Accessibility testing integration (axe-core)
- Export services (CSV/JSON)
