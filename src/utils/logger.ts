const DEBUG_SERVER_URL = 'http://localhost:9223';

export const Logger = {
  info: (scope: string, message: string, data?: unknown) => sendLog('info', scope, message, data),
  warn: (scope: string, message: string, data?: unknown) => sendLog('warn', scope, message, data),
  error: (scope: string, error: unknown, data?: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    sendLog('error', scope, message, data || error);
  },
  debug: (scope: string, message: string, data?: unknown) => sendLog('debug', scope, message, data),
};

function sendLog(type: string, scope: string, message: string, data?: unknown) {
  const fullMessage = `[${scope}] ${message}`;
  
  // Always log to console as fallback/local debugging
  if (type === 'error') {
    if (data !== undefined) {
      console.error(fullMessage, data);
    } else {
      console.error(fullMessage);
    }
  } else {
    if (data !== undefined) {
      console.log(`[${type.toUpperCase()}] ${fullMessage}`, data);
    } else {
      console.log(`[${type.toUpperCase()}] ${fullMessage}`);
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
        type,
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
