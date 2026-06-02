import { Component, type ComponentChildren } from 'preact'
import { useCallback, useState } from 'preact/hooks'
import { memo } from 'preact/compat'
import { type Signal } from '@preact/signals'
import type { Theme } from '../types'

// ============================================================================
// LOGGER - Simple UI Logger
// ============================================================================

const DEBUG_SERVER_URL = 'http://localhost:9223';

function sendLog(type: string, context: string, message: string, data?: unknown) {
  const fullMessage = `[${context}] ${message}`;

  // Always log to console as fallback/local debugging
  if (type === 'error') {
    if (data !== undefined) {
      console.error(`[UI ERROR] ${fullMessage}`, data);
    } else {
      console.error(`[UI ERROR] ${fullMessage}`);
    }
  } else {
    const prefix = `[UI ${type.toUpperCase()}]`;
    if (data !== undefined) {
      console.log(`${prefix} ${fullMessage}`, data);
    } else {
      console.log(`${prefix} ${fullMessage}`);
    }
  }

  // Send to proxy
  try {
    fetch(DEBUG_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: `UI-${type}`,
        message: fullMessage,
        data
      }),
    }).catch(() => {
      // Silently fail if server is not running
    });
  } catch (_e) {
    // Ignore errors
  }
}

export const Logger = {
  info: (context: string, message: string, data?: unknown) => sendLog('info', context, message, data),
  error: (context: string, error: unknown, data?: unknown) => sendLog('error', context, error instanceof Error ? error.message : String(error), data),
  warn: (context: string, message: string, data?: unknown) => sendLog('warn', context, message, data),
  debug: (context: string, message?: string, data?: unknown) => sendLog('debug', context, message || '', data)
}

// ============================================================================
// ERROR BOUNDARY - Figma Plugin Best Practice
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ComponentChildren
  fallback?: (error: Error) => ComponentChildren
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('Plugin UI Error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error)
      }

      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#ef4444',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>
            Something went wrong
          </h3>
          <p style={{
            margin: '0',
            fontSize: '14px',
            color: '#7f1d1d'
          }}>
            The plugin encountered an error. Please try restarting Figma.
          </p>
          {this.state.error && (
            <details style={{ marginTop: '10px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px' }}>
                Error details
              </summary>
              <pre style={{
                fontSize: '11px',
                backgroundColor: '#f9fafb',
                padding: '8px',
                borderRadius: '4px',
                marginTop: '5px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

// ============================================================================
// AUTO RESIZE TEXTAREA - Textarea that automatically adjusts height
// ============================================================================

interface AutoResizeTextareaProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  theme: Signal<Theme>
}

import { getStyles } from './theme'

export const AutoResizeTextarea = memo<AutoResizeTextareaProps>(function AutoResizeTextarea({
  value,
  onChange,
  rows = 1,
  theme
}: AutoResizeTextareaProps) {
  const [isFocused, setIsFocused] = useState(false)
  const styles = getStyles(theme.value)

  const textareaRef = useCallback((node: HTMLTextAreaElement | null) => {
    if (node) {
      node.style.height = 'auto'
      node.style.height = `${node.scrollHeight}px`
    }
  }, [])

  const handleInput = useCallback(
    (event: Event) => {
      const target = event.currentTarget as HTMLTextAreaElement
      target.style.height = 'auto'
      target.style.height = `${target.scrollHeight}px`
      onChange(target.value)
    },
    [onChange]
  )

  return (
    <textarea
      ref={textareaRef}
      style={{
        ...styles.formTextarea,
        ...(isFocused ? styles.formTextareaFocus : {})
      }}
      value={value}
      onInput={handleInput}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      rows={rows}
    />
  )
})

