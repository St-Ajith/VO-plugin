import { useCallback, useState, useEffect } from 'preact/hooks'
import { memo } from 'preact/compat'
import { useSignalEffect, type Signal } from '@preact/signals'
import { emit } from '@create-figma-plugin/utilities'
import { AutoResizeTextarea } from '../utils'
import { getStyles } from '../theme'
import { isAnnotationPending } from '../../store'
import type { Theme, Annotation, PluginActionMessages } from '../../types'

// ============================================================================
// ACCORDION ITEM COMPONENT
// ============================================================================

export interface AccordionItemProps {
  annotation: Annotation
  index: number
  total: number
  theme: Signal<Theme>
  onUpdate: (id: number, data: Partial<Annotation>) => void
  onDelete: (id: number) => void
  onReorder: (id: number, direction: 'up' | 'down') => void
  expandedAnnotationId: Signal<number | null>
}

// Custom comparison function for memo to ensure reactivity when annotation updates
// Re-renders when annotation.id or annotation.updatedAt changes
// This ensures the component updates when annotation data changes in the store
const accordionItemComparison = (
  prevProps: AccordionItemProps,
  nextProps: AccordionItemProps
): boolean => {
  // Re-render if annotation ID changed (different annotation)
  if (prevProps.annotation.id !== nextProps.annotation.id) {
    return false; // Props are different, should re-render
  }
  
  // Re-render if annotation was updated (updatedAt changed)
  if (prevProps.annotation.updatedAt !== nextProps.annotation.updatedAt) {
    return false; // Props are different, should re-render
  }
  
  // Re-render if other props changed
  if (
    prevProps.index !== nextProps.index ||
    prevProps.total !== nextProps.total ||
    prevProps.theme !== nextProps.theme ||
    prevProps.onUpdate !== nextProps.onUpdate ||
    prevProps.onDelete !== nextProps.onDelete ||
    prevProps.onReorder !== nextProps.onReorder ||
    prevProps.expandedAnnotationId !== nextProps.expandedAnnotationId
  ) {
    return false; // Props are different, should re-render
  }
  
  // Props are equal, skip re-render
  return true;
};

export const AccordionItem = memo<AccordionItemProps>(
  function AccordionItem({
    annotation,
    index,
    total,
    theme,
    onUpdate,
    onDelete,
    onReorder,
    expandedAnnotationId
  }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const styles = getStyles(theme.value)
  
  // Local state for pending annotations - maintains user input until table is created
  const [localAnnotation, setLocalAnnotation] = useState<Annotation | null>(null)
  const isPending = isAnnotationPending(annotation.id)
  
  // Initialize local state when annotation becomes pending
  useEffect(() => {
    if (isPending && !localAnnotation) {
      // Create local copy when annotation becomes pending
      setLocalAnnotation({ ...annotation })
    } else if (!isPending && localAnnotation) {
      // Clear local state when annotation is no longer pending
      // The annotation prop should now have the synced state from the plugin
      setLocalAnnotation(null)
    }
  }, [isPending, annotation.id, localAnnotation])
  
  // Use local state if pending, otherwise use annotation from props
  const displayAnnotation = isPending && localAnnotation ? localAnnotation : annotation

  // Expand accordion when expandedAnnotationId matches this annotation's ID
  useSignalEffect(() => {
    if (expandedAnnotationId.value === annotation.id && !isOpen) {
      setIsOpen(true)
    }
  })

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      const parts = field.split('.')
      const baseAnnotation = isPending && localAnnotation ? localAnnotation : annotation
      const updateData: Partial<Annotation> = { id: annotation.id }

      if (parts[0] === 'mobile' && parts.length >= 3) {
        const platformKey = parts[1] as string;
        const fieldKey = parts[2] as string;
        updateData.mobile = {
          ...baseAnnotation.mobile!,
          [platformKey]: {
            ...baseAnnotation.mobile![platformKey as 'ios' | 'android'],
            [fieldKey]: value
          }
        }
      } else if (parts[0] === 'web' && parts.length >= 2) {
        const fieldKey = parts[1] as string;
        updateData.web = {
          ...baseAnnotation.web!,
          [fieldKey]: value
        }
      }

      // Update voiced preview if label changed
      if (field.includes('label')) {
        const label =
          baseAnnotation.platform === 'mobile'
            ? updateData.mobile?.ios?.label || baseAnnotation.mobile?.ios?.label
            : updateData.web?.ariaLabel || baseAnnotation.web?.ariaLabel
        const newVoicedPreview = `"${label}."`
        updateData.voicedPreview = newVoicedPreview
        
        // Also emit real-time update for voicedPreview since it depends on label
        // CRITICAL: Include frameId for composite key matching
        emit('field-update-realtime' as keyof PluginActionMessages, {
          annotationId: annotation.id,
          frameId: annotation.frameId,
          field: 'voicedPreview',
          value: newVoicedPreview,
          source: 'ui'
        } as PluginActionMessages['field-update-realtime'])
      }

      // If pending, update local state immediately (optimistic update)
      if (isPending) {
        const updatedLocal = { ...baseAnnotation, ...updateData }
        setLocalAnnotation(updatedLocal)
      }

      // Send real-time update to canvas immediately (bypass debounce)
      // This is fire-and-forget for pending annotations - plugin may not sync yet
      // CRITICAL: Include frameId for composite key matching
      emit('field-update-realtime' as keyof PluginActionMessages, {
        annotationId: annotation.id,
        frameId: annotation.frameId,
        field: field,
        value: value,
        source: 'ui'
      } as PluginActionMessages['field-update-realtime'])

      // Also trigger normal debounced update for persistence
      // For pending annotations, this updates the store but won't sync to canvas until table exists
      onUpdate(annotation.id, updateData)
    },
    [annotation, isPending, localAnnotation, onUpdate]
  )

  const handleDelete = useCallback(() => {
    if (confirm('Are you sure you want to delete this annotation?')) {
      onDelete(annotation.id)
    }
  }, [annotation.id, onDelete])

  return (
    <div style={styles.accordionItem}>
      <button
        style={{
          ...styles.accordionTrigger,
          ...(isHovered ? styles.accordionTriggerHover : {}),
          ...(isOpen ? styles.accordionTriggerOpen : {})
        }}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div style={styles.accordionNumber}>{annotation.id}</div>
        <div style={styles.accordionPreview}>
          <span style={styles.accordionPreviewLabel}>Voiced preview</span>
          <strong style={styles.accordionPreviewText}>
            {displayAnnotation.voicedPreview}
          </strong>
        </div>
        <div style={styles.accordionActions} onClick={(e) => e.stopPropagation()}>
          {index > 0 && (
            <button
              style={styles.accordionActionBtn}
              onClick={() => onReorder(annotation.id, 'up')}
              title="Move up"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = styles.accordionActionBtnHover.backgroundColor
                e.currentTarget.style.borderColor = styles.accordionActionBtnHover.borderColor
                e.currentTarget.style.color = styles.accordionActionBtnHover.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = styles.accordionActionBtn.border
                e.currentTarget.style.color = styles.accordionActionBtn.color
              }}
            >
              ↑
            </button>
          )}
          {index < total - 1 && (
            <button
              style={styles.accordionActionBtn}
              onClick={() => onReorder(annotation.id, 'down')}
              title="Move down"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = styles.accordionActionBtnHover.backgroundColor
                e.currentTarget.style.borderColor = styles.accordionActionBtnHover.borderColor
                e.currentTarget.style.color = styles.accordionActionBtnHover.color
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = styles.accordionActionBtn.border
                e.currentTarget.style.color = styles.accordionActionBtn.color
              }}
            >
              ↓
            </button>
          )}
          <button
            style={{
              ...styles.accordionActionBtn,
              ...styles.accordionActionBtnDelete
            }}
            onClick={handleDelete}
            title="Delete"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = styles.accordionActionBtnDeleteHover.backgroundColor
              e.currentTarget.style.borderColor = styles.accordionActionBtnDeleteHover.borderColor
              e.currentTarget.style.color = styles.accordionActionBtnDeleteHover.color
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.borderColor = styles.accordionActionBtnDelete.borderColor
              e.currentTarget.style.color = styles.accordionActionBtnDelete.color
            }}
          >
            🗑
          </button>
        </div>
        <span
          style={{
            ...styles.accordionIcon,
            ...(isOpen ? styles.accordionIconOpen : {})
          }}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div style={styles.accordionPanel}>
          {displayAnnotation.platform === 'mobile' && displayAnnotation.mobile ? (
            <div style={styles.annotationColumns}>
              <div style={styles.annotationColumn}>
                <h4 style={styles.formHeading}>iOS (VoiceOver)</h4>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Label</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.ios.label}
                    onChange={(value) =>
                      handleFieldChange('mobile.ios.label', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Value</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.ios.value}
                    onChange={(value) =>
                      handleFieldChange('mobile.ios.value', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Trait</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.ios.trait}
                    onChange={(value) =>
                      handleFieldChange('mobile.ios.trait', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Hint</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.ios.hint}
                    onChange={(value) =>
                      handleFieldChange('mobile.ios.hint', value)
                    }
                    rows={2}
                    theme={theme}
                  />
                </div>
              </div>
              <div style={styles.annotationColumn}>
                <h4 style={styles.formHeading}>Android (TalkBack)</h4>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Label</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.android.label}
                    onChange={(value) =>
                      handleFieldChange('mobile.android.label', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Value</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.android.value}
                    onChange={(value) =>
                      handleFieldChange('mobile.android.value', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Trait</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.android.trait}
                    onChange={(value) =>
                      handleFieldChange('mobile.android.trait', value)
                    }
                    theme={theme}
                  />
                </div>
                <div style={styles.formField}>
                  <label style={styles.formLabel}>Hint</label>
                  <AutoResizeTextarea
                    value={displayAnnotation.mobile.android.hint}
                    onChange={(value) =>
                      handleFieldChange('mobile.android.hint', value)
                    }
                    rows={2}
                    theme={theme}
                  />
                </div>
              </div>
            </div>
          ) : displayAnnotation.platform === 'web' && displayAnnotation.web ? (
            <div style={{ ...styles.annotationColumn, gridColumn: '1 / -1' }}>
              <h4 style={styles.formHeading}>Web (ARIA)</h4>
              <div style={styles.formField}>
                <label style={styles.formLabel}>aria-label</label>
                <AutoResizeTextarea
                  value={displayAnnotation.web.ariaLabel}
                  onChange={(value) =>
                    handleFieldChange('web.ariaLabel', value)
                  }
                  theme={theme}
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>role</label>
                <AutoResizeTextarea
                  value={displayAnnotation.web.role}
                  onChange={(value) => handleFieldChange('web.role', value)}
                  theme={theme}
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>aria-describedby</label>
                <AutoResizeTextarea
                  value={displayAnnotation.web.ariaDescribedBy}
                  onChange={(value) =>
                    handleFieldChange('web.ariaDescribedBy', value)
                  }
                  theme={theme}
                />
              </div>
              <div style={styles.formField}>
                <label style={styles.formLabel}>tabindex</label>
                <AutoResizeTextarea
                  value={displayAnnotation.web.tabIndex}
                  onChange={(value) =>
                    handleFieldChange('web.tabIndex', value)
                  }
                  theme={theme}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
},
accordionItemComparison
)

