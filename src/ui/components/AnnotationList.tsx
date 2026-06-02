import { type Signal } from '@preact/signals'
import { Show } from '@preact/signals/utils'
import { useRef, useEffect, useState, useMemo } from 'preact/hooks'
import { getStyles } from '../theme'
import type { Theme, Annotation } from '../../types'
import { AccordionItem } from './AccordionItem'
import { performanceSettings } from '../../store'
import { benchmark, PERFORMANCE_THRESHOLDS } from '../../utils/benchmark'

// Re-export AccordionItem for backward compatibility
export { AccordionItem }

// ============================================================================
// VIRTUALIZED LIST - Performance optimization for 20+ annotations
// ============================================================================

// Note: ITEM_HEIGHT assumes collapsed accordion items. When items expand, 
// the fixed height calculation may cause scroll positioning issues.
// This is a known limitation - expanded items are not fully supported in virtualized mode.
const ITEM_HEIGHT = 80; // Estimated height per accordion item (collapsed)
const OVERSCAN_COUNT = 3; // Number of items to render outside viewport
const VIRTUALIZATION_THRESHOLD = 20; // Enable virtualization for 20+ items

interface VirtualizedListProps {
  items: Annotation[]
  renderItem: (annotation: Annotation, index: number) => preact.VNode
  itemHeight: number
  overscan?: number
  containerStyle?: Record<string, string | number>
}

function VirtualizedList({ 
  items, 
  renderItem, 
  itemHeight,
  overscan = OVERSCAN_COUNT,
  containerStyle = {}
}: VirtualizedListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Track scroll position
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      setScrollTop(container.scrollTop)
    }

    // Set initial height
    setContainerHeight(container.clientHeight)

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    // Update container height on resize
    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(container.clientHeight)
    })
    resizeObserver.observe(container)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [])

  // Calculate visible range
  const { startIndex, endIndex, offsetY, totalHeight } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(items.length, start + visibleCount + overscan * 2)
    
    return {
      startIndex: start,
      endIndex: end,
      offsetY: start * itemHeight,
      totalHeight: items.length * itemHeight
    }
  }, [scrollTop, containerHeight, items.length, itemHeight, overscan])

  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex)
  }, [items, startIndex, endIndex])

  return (
    <div 
      ref={containerRef}
      style={{ 
        ...containerStyle,
        height: '100%',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, idx) => renderItem(item, startIndex + idx))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ANNOTATION LIST COMPONENT
// ============================================================================

export interface AnnotationListProps {
  currentFrameId: Signal<string | null>
  frameAnnotations: Signal<Annotation[]>
  platformAnnotations: Signal<Annotation[]>
  currentPlatform: Signal<'mobile' | 'web'>
  screens: Signal<{ id: string; name: string }[]>
  theme: Signal<Theme>
  expandedAnnotationId: Signal<number | null>
  onUpdate: (id: number, data: Partial<Annotation>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'up' | 'down') => void
}

export function AnnotationList({
  currentFrameId,
  frameAnnotations,
  platformAnnotations,
  currentPlatform,
  screens,
  theme,
  expandedAnnotationId,
  onUpdate,
  onDelete,
  onReorder
}: AnnotationListProps) {
  const styles = getStyles(theme.value)
  
  // PERFORMANCE: Check if virtualization should be enabled (independent of monitoring)
  const shouldVirtualize = platformAnnotations.value.length >= VIRTUALIZATION_THRESHOLD
  
  // PERFORMANCE: Track list render time when monitoring is enabled
  // Use a ref to prevent duplicate measurements
  const measurementInProgressRef = useRef(false)
  const renderCountRef = useRef(0)
  
  useEffect(() => {
    // Only measure if monitoring is enabled and not already measuring
    if (performanceSettings.value.enableMonitoring && 
        platformAnnotations.value.length > 0 && 
        !measurementInProgressRef.current) {
      
      renderCountRef.current++;
      const perfId = `annotation-list-render-${platformAnnotations.value.length}-${renderCountRef.current}`;
      measurementInProgressRef.current = true;
      
      benchmark.start(perfId);
      // Use requestAnimationFrame to measure after render
      // Note: This measures "time to next frame" not exact render time
      requestAnimationFrame(() => {
        benchmark.stop(perfId, PERFORMANCE_THRESHOLDS.ANNOTATION_LIST_RENDER);
        measurementInProgressRef.current = false;
      });
    }
  }, [platformAnnotations.value.length])
  
  // Render function for individual items
  const renderAnnotationItem = (annotation: Annotation, index: number) => (
    <AccordionItem
      key={annotation.id}
      annotation={annotation}
      index={index}
      total={platformAnnotations.value.length}
      theme={theme}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onReorder={onReorder}
      expandedAnnotationId={expandedAnnotationId}
    />
  )

  return (
    <Show when={() => !currentFrameId.value} fallback={
      <Show when={() => frameAnnotations.value.length === 0} fallback={
        <Show when={() => platformAnnotations.value.length === 0} fallback={
          shouldVirtualize ? (
            <VirtualizedList
              items={platformAnnotations.value}
              renderItem={renderAnnotationItem}
              itemHeight={ITEM_HEIGHT}
              containerStyle={styles.accordionList}
            />
          ) : (
            <div style={styles.accordionList}>
              {platformAnnotations.value.map((annotation, index) => 
                renderAnnotationItem(annotation, index)
              )}
            </div>
          )
        }>
          <div style={styles.emptyState}>
            <h3 style={styles.emptyStateTitle}>No {currentPlatform.value} annotations</h3>
            <p style={styles.emptyStateDesc}>
              Switch to the other platform tab or create new annotations for{' '}
              {currentPlatform.value}.
            </p>
          </div>
        </Show>
      }>
        <div style={styles.emptyState}>
          <h3 style={styles.emptyStateTitle}>No annotations yet</h3>
          <p style={styles.emptyStateDesc}>
            No annotations yet for{' '}
            {(() => {
              const frameId = currentFrameId.value
              return frameId
                ? screens.value.find((s) => s.id === frameId)?.name || 'this screen'
                : 'this screen'
            })()}
            . Select an element and click "Add Annotation" to begin.
          </p>
        </div>
      </Show>
    }>
      <div style={styles.emptyState}>
        <h3 style={styles.emptyStateTitle}>No annotations yet</h3>
        <p style={styles.emptyStateDesc}>
          Please select a screen from the dropdown above to start adding
          annotations.
        </p>
      </div>
    </Show>
  )
}

