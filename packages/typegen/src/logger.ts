/**
 * @xrmforge/typegen - Logger
 *
 * Abstracted logging interface that decouples log output from the modules.
 * Supports: CLI (human-readable), CI/CD (structured JSON), silent (library use).
 *
 * Every logger instance carries a `scope` (e.g. "auth", "metadata", "http")
 * so log consumers can filter by origin module.
 *
 * Consumers can provide their own LogSink to integrate with any logging framework.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface LogEntry {
  level: LogLevel;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Interface for log output destinations.
 * Implement this to route XrmForge logs into your own logging system.
 */
export interface LogSink {
  write(entry: LogEntry): void;

  /**
   * Write an inline progress update (no trailing newline).
   * Used for long-running operations where each entity gets a status indicator.
   *
   * Sinks that don't support inline progress (e.g. JSON) should fall back
   * to writing a regular INFO entry.
   */
  writeProgress(message: string): void;

  /**
   * Complete an inline progress line with a trailing message and newline.
   */
  writeProgressEnd(message: string): void;
}

/**
 * Default CLI log sink with human-readable output and ANSI color indicators.
 */
export class ConsoleLogSink implements LogSink {
  private static readonly LEVEL_PREFIX: Readonly<Record<LogLevel, string>> = {
    [LogLevel.DEBUG]: '\x1b[90m[DBG]\x1b[0m',
    [LogLevel.INFO]: '\x1b[36m[INF]\x1b[0m',
    [LogLevel.WARN]: '\x1b[33m[WRN]\x1b[0m',
    [LogLevel.ERROR]: '\x1b[31m[ERR]\x1b[0m',
    [LogLevel.SILENT]: '',
  };

  write(entry: LogEntry): void {
    if (entry.level === LogLevel.SILENT) return;

    const prefix = ConsoleLogSink.LEVEL_PREFIX[entry.level];
    const scope = `\x1b[90m[${entry.scope}]\x1b[0m`;
    const message = `${prefix} ${scope} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      default:
        console.log(message);
    }

    if (entry.context && entry.level === LogLevel.DEBUG) {
      console.log('   Context:', JSON.stringify(entry.context, null, 2));
    }
  }

  writeProgress(message: string): void {
    process.stdout.write(message);
  }

  writeProgressEnd(message: string): void {
    console.log(message);
  }
}

/**
 * Structured JSON log sink for CI/CD pipelines and machine-readable output.
 */
export class JsonLogSink implements LogSink {
  write(entry: LogEntry): void {
    if (entry.level === LogLevel.SILENT) return;

    const output = {
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      scope: entry.scope,
      message: entry.message,
      ...(entry.context ? { context: entry.context } : {}),
    };

    console.log(JSON.stringify(output));
  }

  writeProgress(message: string): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      scope: 'progress',
      message: message.trim(),
    }));
  }

  writeProgressEnd(message: string): void {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      scope: 'progress',
      message: message.trim(),
    }));
  }
}

/**
 * Silent log sink that discards all output. Used when running as a library.
 */
export class SilentLogSink implements LogSink {
  write(_entry: LogEntry): void {}
  writeProgress(_message: string): void {}
  writeProgressEnd(_message: string): void {}
}

// ─── Logger Class ────────────────────────────────────────────────────────────

/**
 * Logger with scope prefix and configurable sink/level.
 *
 * Usage:
 * ```ts
 * const log = createLogger('auth');
 * log.info('Token acquired', { expiresIn: '3600s' });
 * // Output: [INF] [auth] Token acquired
 * ```
 */
export class Logger {
  private readonly scope: string;
  private readonly getSink: () => LogSink;
  private readonly getMinLevel: () => LogLevel;

  constructor(scope: string, getSink: () => LogSink, getMinLevel: () => LogLevel) {
    this.scope = scope;
    this.getSink = getSink;
    this.getMinLevel = getMinLevel;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Write an inline progress update (no newline).
   */
  progress(message: string): void {
    if (this.getMinLevel() > LogLevel.INFO) return;
    this.getSink().writeProgress(message);
  }

  /**
   * Complete an inline progress line.
   */
  progressEnd(message: string): void {
    if (this.getMinLevel() > LogLevel.INFO) return;
    this.getSink().writeProgressEnd(message);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (level < this.getMinLevel()) return;

    this.getSink().write({
      level,
      scope: this.scope,
      message,
      context,
      timestamp: new Date(),
    });
  }
}

// ─── Global Configuration ────────────────────────────────────────────────────

let _sharedSink: LogSink = new ConsoleLogSink();
let _sharedMinLevel: LogLevel = LogLevel.INFO;

/**
 * Configure logging globally for all @xrmforge modules.
 * Can be called at any time; existing loggers will pick up the new configuration
 * automatically because they reference the shared state via closures.
 *
 * @example
 * ```ts
 * configureLogging({ sink: new JsonLogSink(), minLevel: LogLevel.WARN });
 * ```
 */
export function configureLogging(options: { sink?: LogSink; minLevel?: LogLevel }): void {
  if (options.sink !== undefined) _sharedSink = options.sink;
  if (options.minLevel !== undefined) _sharedMinLevel = options.minLevel;
}

/**
 * Create a scoped logger instance. All modules should use this instead of console.log.
 *
 * The logger reads the global sink and minLevel at each log call (not at creation time),
 * so `configureLogging()` takes effect even on previously created loggers.
 *
 * @param scope - Module identifier shown in log output, e.g. "auth", "metadata", "http"
 */
export function createLogger(scope: string): Logger {
  return new Logger(
    scope,
    () => _sharedSink,
    () => _sharedMinLevel,
  );
}
