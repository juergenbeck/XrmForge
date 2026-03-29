import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Logger,
  LogLevel,
  ConsoleLogSink,
  JsonLogSink,
  SilentLogSink,
  configureLogging,
  createLogger,
} from '../src/logger.js';
import type { LogEntry, LogSink } from '../src/logger.js';

// ─── Test Sink (captures entries) ────────────────────────────────────────────

class TestSink implements LogSink {
  public entries: LogEntry[] = [];
  public progressMessages: string[] = [];
  public progressEndMessages: string[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }

  writeProgress(message: string): void {
    this.progressMessages.push(message);
  }

  writeProgressEnd(message: string): void {
    this.progressEndMessages.push(message);
  }
}

// ─── Logger ──────────────────────────────────────────────────────────────────

describe('Logger', () => {
  it('should log messages at or above minLevel', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.INFO);

    logger.debug('should be filtered');
    logger.info('should pass');
    logger.warn('should pass');
    logger.error('should pass');

    expect(sink.entries).toHaveLength(3);
    expect(sink.entries[0]!.level).toBe(LogLevel.INFO);
    expect(sink.entries[1]!.level).toBe(LogLevel.WARN);
    expect(sink.entries[2]!.level).toBe(LogLevel.ERROR);
  });

  it('should include scope in every entry', () => {
    const sink = new TestSink();
    const logger = new Logger('auth', () => sink, () => LogLevel.DEBUG);

    logger.info('token acquired');

    expect(sink.entries[0]!.scope).toBe('auth');
  });

  it('should include context when provided', () => {
    const sink = new TestSink();
    const logger = new Logger('http', () => sink, () => LogLevel.DEBUG);

    logger.debug('request', { url: 'https://example.com', status: 200 });

    expect(sink.entries[0]!.context).toEqual({ url: 'https://example.com', status: 200 });
  });

  it('should not include context when not provided', () => {
    const sink = new TestSink();
    const logger = new Logger('http', () => sink, () => LogLevel.DEBUG);

    logger.info('done');

    expect(sink.entries[0]!.context).toBeUndefined();
  });

  it('should include timestamp', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.DEBUG);

    const before = new Date();
    logger.info('test');
    const after = new Date();

    const timestamp = sink.entries[0]!.timestamp;
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should filter all messages at SILENT level', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.SILENT);

    logger.debug('no');
    logger.info('no');
    logger.warn('no');
    logger.error('no');

    expect(sink.entries).toHaveLength(0);
  });

  it('should pass DEBUG level including context', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.DEBUG);

    logger.debug('detail', { key: 'value' });

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]!.level).toBe(LogLevel.DEBUG);
    expect(sink.entries[0]!.context).toEqual({ key: 'value' });
  });
});

// ─── Progress ────────────────────────────────────────────────────────────────

describe('Logger progress', () => {
  it('should delegate progress to sink', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.INFO);

    logger.progress('loading...');
    logger.progressEnd(' done');

    expect(sink.progressMessages).toEqual(['loading...']);
    expect(sink.progressEndMessages).toEqual([' done']);
  });

  it('should suppress progress when level is above INFO', () => {
    const sink = new TestSink();
    const logger = new Logger('test', () => sink, () => LogLevel.WARN);

    logger.progress('loading...');
    logger.progressEnd(' done');

    expect(sink.progressMessages).toHaveLength(0);
    expect(sink.progressEndMessages).toHaveLength(0);
  });
});

// ─── ConsoleLogSink ──────────────────────────────────────────────────────────

describe('ConsoleLogSink', () => {
  let sink: ConsoleLogSink;

  beforeEach(() => {
    sink = new ConsoleLogSink();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should route ERROR to console.error', () => {
    sink.write({ level: LogLevel.ERROR, scope: 'test', message: 'fail', timestamp: new Date() });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('should route WARN to console.warn', () => {
    sink.write({ level: LogLevel.WARN, scope: 'test', message: 'warn', timestamp: new Date() });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('should route INFO to console.log', () => {
    sink.write({ level: LogLevel.INFO, scope: 'test', message: 'info', timestamp: new Date() });
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('should suppress SILENT entries', () => {
    sink.write({ level: LogLevel.SILENT, scope: 'test', message: 'silent', timestamp: new Date() });
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should log context at DEBUG level', () => {
    sink.write({
      level: LogLevel.DEBUG,
      scope: 'test',
      message: 'detail',
      context: { key: 'value' },
      timestamp: new Date(),
    });
    // DEBUG with context: 1 call for message + 1 call for context
    expect(console.log).toHaveBeenCalledTimes(2);
  });
});

// ─── JsonLogSink ─────────────────────────────────────────────────────────────

describe('JsonLogSink', () => {
  let sink: JsonLogSink;

  beforeEach(() => {
    sink = new JsonLogSink();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output valid JSON', () => {
    sink.write({
      level: LogLevel.INFO,
      scope: 'http',
      message: 'request',
      timestamp: new Date('2026-01-01T00:00:00Z'),
    });

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('INFO');
    expect(parsed.scope).toBe('http');
    expect(parsed.message).toBe('request');
    expect(parsed.timestamp).toBe('2026-01-01T00:00:00.000Z');
  });

  it('should include context when present', () => {
    sink.write({
      level: LogLevel.INFO,
      scope: 'http',
      message: 'request',
      context: { url: '/contacts' },
      timestamp: new Date(),
    });

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.context).toEqual({ url: '/contacts' });
  });

  it('should not include context when absent', () => {
    sink.write({
      level: LogLevel.INFO,
      scope: 'http',
      message: 'request',
      timestamp: new Date(),
    });

    const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.context).toBeUndefined();
  });
});

// ─── SilentLogSink ───────────────────────────────────────────────────────────

describe('SilentLogSink', () => {
  it('should not throw on any operation', () => {
    const sink = new SilentLogSink();

    expect(() => {
      sink.write({ level: LogLevel.ERROR, scope: 'test', message: 'x', timestamp: new Date() });
      sink.writeProgress('x');
      sink.writeProgressEnd('x');
    }).not.toThrow();
  });
});

// ─── Global Configuration ────────────────────────────────────────────────────

describe('configureLogging + createLogger', () => {
  afterEach(() => {
    // Reset to defaults
    configureLogging({ sink: new ConsoleLogSink(), minLevel: LogLevel.INFO });
  });

  it('should use configured sink and minLevel', () => {
    const sink = new TestSink();
    configureLogging({ sink, minLevel: LogLevel.WARN });

    const logger = createLogger('test');
    logger.info('filtered');
    logger.warn('passes');

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]!.level).toBe(LogLevel.WARN);
  });

  it('should apply scope from createLogger', () => {
    const sink = new TestSink();
    configureLogging({ sink, minLevel: LogLevel.DEBUG });

    const logger = createLogger('metadata');
    logger.info('test');

    expect(sink.entries[0]!.scope).toBe('metadata');
  });

  it('should affect loggers created BEFORE configureLogging (R3-07 fix)', () => {
    // Create logger with default config (ConsoleLogSink, INFO)
    const logger = createLogger('early');

    // Now reconfigure to a test sink
    const sink = new TestSink();
    configureLogging({ sink, minLevel: LogLevel.DEBUG });

    // The previously created logger should use the NEW sink
    logger.info('after reconfigure');

    expect(sink.entries).toHaveLength(1);
    expect(sink.entries[0]!.message).toBe('after reconfigure');
    expect(sink.entries[0]!.scope).toBe('early');
  });

  it('should respect minLevel changes on existing loggers (R3-07 fix)', () => {
    const sink = new TestSink();
    configureLogging({ sink, minLevel: LogLevel.DEBUG });

    const logger = createLogger('test');
    logger.debug('should pass');

    // Raise minLevel
    configureLogging({ minLevel: LogLevel.ERROR });

    logger.debug('should be filtered');
    logger.info('should be filtered');
    logger.error('should pass');

    expect(sink.entries).toHaveLength(2);
    expect(sink.entries[0]!.message).toBe('should pass');
    expect(sink.entries[1]!.message).toBe('should pass');
  });
});

// ─── LogLevel ordering ──────────────────────────────────────────────────────

describe('LogLevel', () => {
  it('should have correct ordering (DEBUG < INFO < WARN < ERROR < SILENT)', () => {
    expect(LogLevel.DEBUG).toBeLessThan(LogLevel.INFO);
    expect(LogLevel.INFO).toBeLessThan(LogLevel.WARN);
    expect(LogLevel.WARN).toBeLessThan(LogLevel.ERROR);
    expect(LogLevel.ERROR).toBeLessThan(LogLevel.SILENT);
  });
});
