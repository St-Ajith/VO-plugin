// ============================================================================
// SIGNALS PROOF-OF-CONCEPT
// Demonstrating how Preact Signals could simplify our complex state management
// ============================================================================

import { signal, computed, effect } from '@preact/signals'
import { useSignal, useComputed, useSignalEffect } from '@preact/signals'

// Current state (16 useState calls) vs Signals approach:

// ============================================================================
// CURRENT APPROACH (Hooks) - 16 useState + 8 useEffect + 3 useMemo
// ============================================================================

/*
function Plugin() {
  // Core Data State (4 variables)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [screens, setScreens] = useState<{ id: string; name: string }[]>([])
  const [currentFrameId, setCurrentFrameId] = useState<string | null>(null)
  const [currentPlatform, setCurrentPlatform] = useState<'mobile' | 'web'>('mobile')

  // UI State (7 variables)
  const [selectionScope, setSelectionScope] = useState<'currentPage' | 'documentWide'>('currentPage')
  const [hasSelection, setHasSelection] = useState(false)
  const [showAll, setShowAll] = useState(true)
  const [theme, setTheme] = useState<Theme>('light')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusedFrameIndex, setFocusedFrameIndex] = useState(-1)

  // Transient State (5 variables)
  const [hasInserted, setHasInserted] = useState<Record<string, boolean>>({})
  const [hasChangedSinceInsert, setHasChangedSinceInsert] = useState(false)
  const [isLoadingFrames, setIsLoadingFrames] = useState(false)
  const [framesError, setFramesError] = useState<string | null>(null)
  const [themeToggleHovered, setThemeToggleHovered] = useState(false)

  // Computed State (3 useMemo calls)
  const frameAnnotations = useMemo(() =>
    annotations.filter((a) => a.frameId === currentFrameId),
    [annotations, currentFrameId]
  )
  const platformAnnotations = useMemo(() =>
    frameAnnotations.filter((a) => a.platform === currentPlatform),
    [frameAnnotations, currentPlatform]
  )
  const filteredFrames = useMemo(() => searchFrames(searchableFrames, debouncedSearchQuery), [...])

  // 8 useEffect hooks for synchronization and side effects...
}
*/

// ============================================================================
// SIGNALS APPROACH - Much simpler!
// ============================================================================

function PluginWithSignals() {
  // ============================================================================
  // SIGNALS STATE (instead of 16 useState calls)
  // ============================================================================

  // Core Data Signals (4 signals)
  const annotations = useSignal<Annotation[]>([])
  const screens = useSignal<{ id: string; name: string }[]>([])
  const currentFrameId = useSignal<string | null>(null)
  const currentPlatform = useSignal<'mobile' | 'web'>('mobile')

  // UI State Signals (7 signals)
  const selectionScope = useSignal<'currentPage' | 'documentWide'>('currentPage')
  const hasSelection = useSignal(false)
  const showAll = useSignal(true)
  const theme = useSignal<Theme>('light')
  const drawerOpen = useSignal(false)
  const searchQuery = useSignal('')
  const focusedFrameIndex = useSignal(-1)

  // Transient State Signals (5 signals)
  const hasInserted = useSignal<Record<string, boolean>>({})
  const hasChangedSinceInsert = useSignal(false)
  const isLoadingFrames = useSignal(false)
  const framesError = useSignal<string | null>(null)
  const themeToggleHovered = useSignal(false)

  // ============================================================================
  // COMPUTED SIGNALS (instead of 3 useMemo calls + complex dependency management)
  // ============================================================================

  // Automatically reactive - no dependency arrays needed!
  const frameAnnotations = useComputed(() =>
    annotations.value.filter((a) => a.frameId === currentFrameId.value)
  )

  const platformAnnotations = useComputed(() =>
    frameAnnotations.value.filter((a) => a.platform === currentPlatform.value)
  )

  // Debounced search (could use a custom signal)
  const debouncedSearchQuery = useSignal('')
  const filteredFrames = useComputed(() =>
    searchFrames(searchableFrames.value, debouncedSearchQuery.value)
  )

  // Complex computed state becomes simple
  const screensWithAnnotations = useComputed(() =>
    screens.value
      .map((screen) => ({
        ...screen,
        count: annotations.value.filter((a) => a.frameId === screen.id).length
      }))
      .sort((a, b) => {
        if (a.count > 0 && b.count === 0) return -1
        if (a.count === 0 && b.count > 0) return 1
        return a.name.localeCompare(b.name)
      })
  )

  const organizedFrameData = useComputed(() =>
    organizeFramesByPages(screens.value, annotations.value)
  )

  const searchableFrames = useComputed(() =>
    createSearchableFrameData(organizedFrameData.value)
  )

  // ============================================================================
  // EFFECTS (instead of 8 useEffect hooks)
  // ============================================================================

  // Debouncing becomes trivial
  useSignalEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearchQuery.value = searchQuery.value
    }, 150)
    return () => clearTimeout(timer)
  })

  // Sync refs automatically
  useSignalEffect(() => {
    currentFrameIdRef.current = currentFrameId.value
  })

  // ============================================================================
  // HANDLERS (simpler, no useCallback needed for most cases)
  // ============================================================================

  const handleFrameSelect = (event: Event) => {
    const target = event.currentTarget as HTMLSelectElement
    currentFrameId.value = target.value || null
    emit<SelectFrameHandler>('SELECT_FRAME', currentFrameId.value)
  }

  const handlePlatformSwitch = (platform: 'mobile' | 'web') => {
    currentPlatform.value = platform
    emit<SwitchPlatformHandler>('SWITCH_PLATFORM', platform)
  }

  // ============================================================================
  // BENEFITS OF SIGNALS APPROACH:
  // ============================================================================

  /*
  ✅ Automatic reactivity - no manual dependency management
  ✅ Computed values update automatically when dependencies change
  ✅ No stale closure issues
  ✅ Simpler mental model
  ✅ Better performance for complex state graphs
  ✅ Less boilerplate code
  ✅ Easier testing

  ⚠️ Trade-offs:
  - Learning curve for Signals API
  - Migration effort from hooks
  - Different debugging experience
  */

  return (
    <div>
      {/* UI would be identical, but state management is much simpler */}
      <p>Current frame: {currentFrameId.value}</p>
      <p>Platform: {currentPlatform.value}</p>
      <p>Annotations count: {platformAnnotations.value.length}</p>
    </div>
  )
}

export default PluginWithSignals
