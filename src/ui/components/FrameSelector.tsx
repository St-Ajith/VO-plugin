import { useComputed, type Signal } from '@preact/signals'
import { Dropdown, Text } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import {
  SelectFrameHandler,
  ZoomToFrameHandler,
  SetSelectionScopeHandler,
  UpdateUserSettingsHandler
} from '../../types'
import { getStyles } from '../theme'
import type { Theme } from '../../types'
import type { PageFrameData } from '../../store'

// ============================================================================
// FRAME SELECTOR COMPONENT
// ============================================================================

export interface FrameSelectorProps {
  currentFrameId: Signal<string | null>
  organizedFrameData: Signal<PageFrameData[]>
  selectionScope: Signal<'currentPage' | 'documentWide'>
  isLoadingFrames: Signal<boolean>
  framesError: Signal<string | null>
  theme: Signal<Theme>
  onGetScreens: () => void
}

export function FrameSelector({
  currentFrameId,
  organizedFrameData,
  selectionScope,
  isLoadingFrames,
  framesError,
  theme,
  onGetScreens
}: FrameSelectorProps) {
  const styles = getStyles(theme.value)

  // Prepare options for Dropdown component - computed from global frame data
  const frameSelectOptions = useComputed(() =>
    organizedFrameData.value.flatMap(page =>
      page.frames.map(frame => ({
        value: frame.id,
        text: `${frame.name}${frame.annotationCount > 0 ? ` (${frame.annotationCount})` : ''} - ${page.name}`
      }))
    )
  )

  // Use currentFrameId directly - no need for computed wrapper

  const handleFrameSelect = (value: string) => {
    const frameId = value || null
    currentFrameId.value = frameId
    emit<SelectFrameHandler>('SELECT_FRAME', frameId)
  }

  const handleZoomToFrame = () => {
    if (currentFrameId.value) {
      emit<ZoomToFrameHandler>('ZOOM_TO_FRAME', currentFrameId.value)
    }
  }

  const handleSelectionScopeChange = (scope: 'currentPage' | 'documentWide') => {
    selectionScope.value = scope
    
    // Send settings update to main plugin context
    emit<UpdateUserSettingsHandler>('UPDATE_USER_SETTINGS', {
      settings: { selectionScope: scope }
    })

    emit<SetSelectionScopeHandler>('SET_SELECTION_SCOPE', scope)
    // Refresh screens when scope changes
    onGetScreens()
  }

  const hasFrames = frameSelectOptions.value.length > 0
  const options = hasFrames ? frameSelectOptions.value : [{ value: '', text: 'No frames available' }]
  const value = currentFrameId.value || (hasFrames ? null : '')
  const disabled = !hasFrames || isLoadingFrames.value

  // Find the selected option to display its text
  const selectedOption = options.find(opt => opt.value === value)
  const displayText = selectedOption ? selectedOption.text :
                    (value ? 'Unknown frame' :
                     hasFrames ? 'Select a frame...' : 'No frames available')

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label htmlFor="frameSelect" style={styles.frameSelectLabel}>
          Frame:
        </label>
        <div style={styles.toggleSwitch}>
          <span
            style={{
              ...styles.toggleLabel,
              ...(selectionScope.value === 'currentPage' ? styles.toggleLabelActive : {})
            }}
          >
            Page
          </span>
          <label
            style={{
              ...styles.toggleTrack,
              ...(selectionScope.value === 'documentWide' ? styles.toggleTrackActive : {})
            }}
          >
            <input
              type="checkbox"
              checked={selectionScope.value === 'documentWide'}
              onChange={(event) => {
                const target = event.currentTarget
                handleSelectionScopeChange(target.checked ? 'documentWide' : 'currentPage')
              }}
              style={{ display: 'none' }}
            />
            <span
              style={{
                ...styles.toggleKnob,
                ...(selectionScope.value === 'documentWide' ? styles.toggleKnobActive : {})
              }}
            />
          </label>
          <span
            style={{
              ...styles.toggleLabel,
              ...(selectionScope.value === 'documentWide' ? styles.toggleLabelActive : {})
            }}
          >
            Document
          </span>
        </div>
      </div>
      <div style={{ marginBottom: '24px' }}>
        <Text style={{
          display: 'block',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '8px',
          color: styles.textPrimary.color
        }}>
          Frame:
        </Text>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <div
              style={{
                ...styles.frameSelect,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                backgroundColor: disabled ? styles.surface.backgroundColor : styles.surfaceActive.backgroundColor,
                color: disabled ? styles.textSecondary.color : styles.textPrimary.color,
                padding: '8px 32px 8px 16px',
                border: `1px solid ${styles.border.borderColor}`,
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              <span>{displayText}</span>
              <span style={{
                fontSize: '12px',
                color: styles.textSecondary.color,
                transform: 'rotate(90deg)'
              }}>▶</span>
            </div>
            <Dropdown
              options={options}
              value={value}
              onChange={(event) => {
                const newValue = event.currentTarget.value
                if (newValue && newValue !== '' && hasFrames) {
                  handleFrameSelect(newValue)
                }
              }}
              {...(hasFrames && { placeholder: "Select a frame..." })}
              disabled={disabled}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                pointerEvents: disabled ? 'none' : 'auto'
              }}
            />
          </div>
          <button
            onClick={handleZoomToFrame}
            disabled={!currentFrameId.value || disabled}
            title="Zoom to selected frame"
            style={{
              padding: '8px 12px',
              border: `1px solid ${styles.border.borderColor}`,
              borderRadius: '6px',
              backgroundColor: currentFrameId.value && !disabled 
                ? styles.surfaceActive.backgroundColor 
                : styles.surface.backgroundColor,
              color: currentFrameId.value && !disabled 
                ? styles.textPrimary.color 
                : styles.textSecondary.color,
              cursor: currentFrameId.value && !disabled ? 'pointer' : 'not-allowed',
              opacity: currentFrameId.value && !disabled ? 1 : 0.6,
              fontSize: '14px',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '40px',
              transition: 'all 0.2s ease'
            }}
          >
            🔍
          </button>
        </div>
        {framesError.value && (
          <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: styles.danger.color + '20',
            color: styles.danger.color,
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {framesError.value}
          </div>
        )}
      </div>
    </div>
  )
}

