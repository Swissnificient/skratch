export function createLogger(scope) {
  return Object.freeze({
    debug: (event, context) => write('debug', scope, event, context),
    info: (event, context) => write('info', scope, event, context),
    warn: (event, context) => write('warn', scope, event, context),
    error: (event, context) => write('error', scope, event, context)
  });
}

function write(level, scope, event, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    event,
    ...sanitizeContext(context)
  };

  const method = console[level] || console.log;
  method('[Skratch]', payload);
}

function sanitizeContext(context) {
  const source = context && typeof context === 'object' ? context : { detail: context };
  const result = {};

  for (const [key, value] of Object.entries(source)) {
    if (value instanceof Error) {
      result[key] = { name: value.name, message: value.message };
    } else if (typeof value === 'string' && value.length > 500) {
      result[key] = `${value.slice(0, 500)}…`;
    } else {
      result[key] = value;
    }
  }

  return result;
}
