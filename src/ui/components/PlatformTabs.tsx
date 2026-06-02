import { type Signal } from '@preact/signals'
import { emit } from '@create-figma-plugin/utilities'
import { SwitchPlatformHandler } from '../../types'
import { getStyles } from '../theme'
import type { Theme } from '../../types'

// ============================================================================
// PLATFORM TABS COMPONENT
// ============================================================================

export interface PlatformTabsProps {
  currentPlatform: Signal<'mobile' | 'web'>
  mobileAnnotationCount: Signal<number>
  webAnnotationCount: Signal<number>
  theme: Signal<Theme>
}

export function PlatformTabs({
  currentPlatform,
  mobileAnnotationCount,
  webAnnotationCount,
  theme
}: PlatformTabsProps) {
  const styles = getStyles(theme.value)

  const handlePlatformSwitch = (platform: 'mobile' | 'web') => {
    currentPlatform.value = platform
    emit<SwitchPlatformHandler>('SWITCH_PLATFORM', platform)
  }

  return (
    <div style={styles.tabControl}>
      <button
        style={{
          ...styles.tabItem,
          ...(currentPlatform.value === 'mobile' ? styles.tabItemActive : {})
        }}
        onClick={() => handlePlatformSwitch('mobile')}
      >
        Mobile{mobileAnnotationCount.value > 0 ? ` (${mobileAnnotationCount.value})` : ''}
      </button>
      <button
        style={{
          ...styles.tabItem,
          ...(currentPlatform.value === 'web' ? styles.tabItemActive : {})
        }}
        onClick={() => handlePlatformSwitch('web')}
      >
        Web{webAnnotationCount.value > 0 ? ` (${webAnnotationCount.value})` : ''}
      </button>
    </div>
  )
}

