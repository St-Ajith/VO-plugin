import type { Theme } from '../types'

// ============================================================================
// THEME SYSTEM
// ============================================================================

export interface ThemeColors {
  background: string
  headerBg: string
  surface: string
  surfaceActive: string
  primary: string
  primaryHover: string
  accent: string
  textPrimary: string
  textSecondary: string
  textOnDark: string
  textOnPrimary: string
  textInactive: string
  border: string
  borderLight: string
  danger: string
}

export const themes: Record<Theme, ThemeColors> = {
  light: {
    background: '#FFFFFF',
    headerBg: '#0D0D0D',
    surface: '#EFEFEF',
    surfaceActive: '#FFFFFF',
    primary: '#1F2937',
    primaryHover: '#374151',
    accent: '#2563EB',
    textPrimary: '#000000',
    textSecondary: '#4B5563',
    textOnDark: '#FFFFFF',
    textOnPrimary: '#FFFFFF',
    textInactive: '#374151',
    border: '#D1D5DB',
    borderLight: '#E5E7EB',
    danger: '#DC2626'
  },
  dark: {
    background: '#1F2937',
    headerBg: '#0D0D0D',
    surface: '#374151',
    surfaceActive: '#4B5563',
    primary: '#F9FAFB',
    primaryHover: '#E5E7EB',
    accent: '#60A5FA',
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',
    textOnDark: '#FFFFFF',
    textOnPrimary: '#1F2937',
    textInactive: '#9CA3AF',
    border: '#4B5563',
    borderLight: '#374151',
    danger: '#F87171'
  }
}

export function getStyles(theme: Theme) {
  // Defensive programming: ensure theme is valid
  const validTheme = ['light', 'dark'].includes(theme) ? theme : 'light'
  const colors = themes[validTheme]
  const isDark = validTheme === 'dark'

  return {
    // Color properties for direct access
    textPrimary: { color: colors.textPrimary },
    textSecondary: { color: colors.textSecondary },
    textOnDark: { color: colors.textOnDark },
    textOnPrimary: { color: colors.textOnPrimary },
    textInactive: { color: colors.textInactive },
    primary: { backgroundColor: colors.primary, color: colors.textOnPrimary },
    surface: { backgroundColor: colors.surface },
    surfaceActive: { backgroundColor: colors.surfaceActive },
    accent: { color: colors.accent },
    border: { borderColor: colors.border },
    borderLight: { borderColor: colors.borderLight },
    danger: { color: colors.danger },

    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px',
      backgroundColor: colors.headerBg,
      color: colors.textOnDark,
      flexShrink: 0
    },
    headerTitle: {
      fontSize: '16px',
      fontWeight: 500,
      margin: 0,
      color: colors.textOnDark
    },
    themeToggle: {
      background: 'none',
      border: `1px solid ${isDark ? colors.border : 'rgba(255, 255, 255, 0.2)'}`,
      borderRadius: '6px',
      padding: '6px 10px',
      cursor: 'pointer',
      color: colors.textOnDark,
      fontSize: '12px',
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease-in-out',
      opacity: 1
    },
    themeToggleHover: {
      opacity: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.15)'
    },
    content: {
      padding: '24px',
      overflowY: 'auto',
      flex: 1,
      backgroundColor: colors.background
    },
    footer: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 24px',
      borderTop: `1px solid ${colors.borderLight}`,
      flexShrink: 0,
      backgroundColor: colors.background
    },
    frameSelect: {
      width: '100%',
      padding: '8px 16px',
      fontSize: '14px',
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      backgroundColor: colors.surfaceActive,
      color: colors.textPrimary,
      cursor: 'pointer',
      marginBottom: '32px',
      fontFamily: 'inherit'
    },
    frameSelectLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: 500,
      marginBottom: '8px',
      color: colors.textPrimary
    },
    tabControl: {
      display: 'flex',
      backgroundColor: colors.surface,
      borderRadius: '9999px',
      padding: '4px',
      marginBottom: '24px'
    },
    tabItem: {
      flex: 1,
      textAlign: 'center',
      backgroundColor: 'transparent',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '9999px',
      fontSize: '16px',
      fontWeight: 500,
      color: colors.textInactive,
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      fontFamily: 'inherit'
    },
    tabItemActive: {
      backgroundColor: colors.surfaceActive,
      color: colors.textPrimary,
      fontWeight: 700,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    },
    emptyState: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '48px 0'
    },
    emptyStateTitle: {
      fontSize: '22px',
      fontWeight: 700,
      color: colors.textPrimary,
      marginBottom: '8px'
    },
    emptyStateDesc: {
      fontSize: '14px',
      color: colors.textSecondary,
      maxWidth: '380px',
      marginBottom: '24px'
    },
    accordionList: {
      border: `1px solid ${colors.borderLight}`,
      borderRadius: '10px',
      overflow: 'hidden',
      backgroundColor: colors.surfaceActive
    },
    accordionItem: {
      borderBottom: `1px solid ${colors.borderLight}`
    },
    accordionTrigger: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '16px',
      backgroundColor: colors.surfaceActive,
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'background-color 0.2s ease-in-out'
    },
    accordionTriggerHover: {
      backgroundColor: isDark ? colors.surface : '#F9FAFB'
    },
    accordionTriggerOpen: {
      backgroundColor: isDark ? colors.surface : '#F3F4F6'
    },
    accordionNumber: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      backgroundColor: colors.primary,
      color: colors.textOnPrimary,
      borderRadius: '6px',
      fontSize: '16px',
      fontWeight: 700,
      flexShrink: 0
    },
    accordionPreview: {
      flex: 1,
      minWidth: 0
    },
    accordionPreviewLabel: {
      display: 'block',
      fontSize: '12px',
      color: colors.textSecondary,
      marginBottom: '2px'
    },
    accordionPreviewText: {
      display: 'block',
      fontSize: '14px',
      color: colors.textPrimary,
      fontWeight: 500,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    },
    accordionActions: {
      display: 'flex',
      gap: '4px',
      flexShrink: 0
    },
    accordionActionBtn: {
      width: '28px',
      height: '28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      cursor: 'pointer',
      color: colors.textSecondary,
      fontSize: '14px',
      transition: 'all 0.2s ease-in-out'
    },
    accordionActionBtnHover: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
      color: colors.primary
    },
    accordionActionBtnDelete: {
      borderColor: colors.danger,
      color: colors.danger
    },
    accordionActionBtnDeleteHover: {
      backgroundColor: isDark ? 'rgba(248, 113, 113, 0.1)' : '#FEE2E2',
      borderColor: colors.danger,
      color: colors.danger
    },
    accordionIcon: {
      fontSize: '12px',
      color: colors.textSecondary,
      transition: 'transform 0.2s ease-in-out',
      flexShrink: 0
    },
    accordionIconOpen: {
      transform: 'rotate(180deg)'
    },
    accordionPanel: {
      padding: '24px',
      backgroundColor: isDark ? colors.surface : '#F9FAFB',
      borderTop: `1px solid ${colors.borderLight}`
    },
    annotationColumns: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '24px'
    },
    annotationColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    formHeading: {
      fontSize: '14px',
      fontWeight: 700,
      color: colors.textPrimary,
      marginBottom: '4px'
    },
    formField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    },
    formLabel: {
      fontSize: '12px',
      fontWeight: 500,
      color: colors.textSecondary
    },
    formTextarea: {
      width: '100%',
      padding: '8px',
      fontSize: '14px',
      color: colors.textPrimary,
      backgroundColor: colors.surfaceActive,
      border: `1px solid ${colors.border}`,
      borderRadius: '6px',
      resize: 'none',
      overflow: 'hidden',
      minHeight: '36px',
      fontFamily: 'inherit',
      transition: 'border-color 0.2s ease-in-out'
    },
    formTextareaFocus: {
      outline: 'none',
      borderColor: colors.accent
    },
    toggleSwitch: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    toggleLabel: {
      fontSize: '14px',
      color: colors.textSecondary,
      transition: 'color 0.2s ease-in-out'
    },
    toggleLabelActive: {
      color: colors.textPrimary,
      fontWeight: 500
    },
    toggleTrack: {
      position: 'relative',
      width: '44px',
      height: '24px',
      backgroundColor: colors.surface,
      borderRadius: '9999px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease-in-out'
    },
    toggleTrackActive: {
      backgroundColor: colors.primary
    },
    toggleKnob: {
      position: 'absolute',
      top: '2px',
      left: '2px',
      width: '20px',
      height: '20px',
      backgroundColor: colors.surfaceActive,
      borderRadius: '50%',
      transition: 'transform 0.2s ease-in-out',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
    },
    toggleKnobActive: {
      transform: 'translateX(20px)'
    },
    addAnnotationButton: {
      fontSize: '14px',
      fontWeight: 500,
      padding: '8px 24px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      backgroundColor: colors.primary,
      color: colors.textOnPrimary,
      width: '100%',
      fontFamily: 'inherit'
    },
    addAnnotationButtonHover: {
      backgroundColor: colors.primaryHover
    },
    addAnnotationButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    addAnnotationButtonDisabledHover: {
      backgroundColor: colors.primary
    },
    footerButton: {
      fontSize: '14px',
      fontWeight: 500,
      padding: '8px 24px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s ease-in-out',
      backgroundColor: colors.primary,
      color: colors.textOnPrimary,
      fontFamily: 'inherit'
    },
    footerButtonHover: {
      backgroundColor: colors.primaryHover
    },
    footerButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    }
  }
}

