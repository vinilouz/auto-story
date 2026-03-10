type Level = 'info' | 'warn' | 'error' | 'success'

const LEVEL_TAG: Record<Level, string> = {
  info: '\x1b[36m INFO\x1b[0m',
  warn: '\x1b[33m WARN\x1b[0m',
  error: '\x1b[31mERROR\x1b[0m',
  success: '\x1b[32m  OK \x1b[0m',
}

function format(level: Level, module: string, msg: string, data?: unknown): string {
  const ts = new Date().toISOString().slice(11, 23)
  const prefix = `[${ts}] ${LEVEL_TAG[level]} [${module}]`
  if (data === undefined) return `${prefix} ${msg}`
  const serialized = data instanceof Error
    ? `${data.message}\n${data.stack ?? ''}`
    : typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return `${prefix} ${msg}\n${serialized}`
}

export interface Logger {
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
  success: (msg: string, data?: unknown) => void
}

export function createLogger(module: string): Logger {
  return {
    info: (msg, data) => console.log(format('info', module, msg, data)),
    warn: (msg, data) => console.warn(format('warn', module, msg, data)),
    error: (msg, data) => console.error(format('error', module, msg, data)),
    success: (msg, data) => console.log(format('success', module, msg, data)),
  }
}