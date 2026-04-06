/**
 * Unified error handling for D365 form event handlers.
 * Wraps sync and async handlers with try/catch and form notifications.
 */
import type { Logger } from './logger.js';
import { NOTIFICATION_IDS } from './constants.js';

type EventHandler = (ctx: Xrm.Events.EventContext, ...args: never[]) => unknown;

/**
 * Wrap a form event handler with error handling.
 *
 * Catches both sync and async errors, logs them, and shows a form notification.
 * The original handler is never rethrown, so form execution continues.
 *
 * @param name - Handler name for logging (e.g. 'MyApp.Account.onLoad')
 * @param logger - Logger instance for error reporting
 * @param handler - The actual event handler function
 */
export function wrapHandler(name: string, logger: Logger, handler: EventHandler): EventHandler {
  const wrapped: EventHandler = (ctx, ...args) => {
    try {
      const result = handler(ctx, ...args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((err: unknown) => {
          logAndNotify(ctx, name, logger, err);
        });
      }
      return result;
    } catch (err: unknown) {
      logAndNotify(ctx, name, logger, err);
    }
  };
  return wrapped;
}

/**
 * Wrap a ribbon command handler with error handling.
 *
 * Unlike wrapHandler, this accepts a FormContext directly (not an EventContext),
 * which is the calling convention for ribbon/command bar handlers.
 *
 * @param name - Handler name for logging
 * @param logger - Logger instance for error reporting
 * @param handler - The actual command handler function
 */
export function wrapCommand(
  name: string,
  logger: Logger,
  handler: (formContext: Xrm.FormContext, ...args: never[]) => unknown,
): (formContext: Xrm.FormContext, ...args: never[]) => unknown {
  return (formContext, ...args) => {
    try {
      const result = handler(formContext, ...args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((err: unknown) => {
          logAndNotifyForm(formContext, name, logger, err);
        });
      }
      return result;
    } catch (err: unknown) {
      logAndNotifyForm(formContext, name, logger, err);
    }
  };
}

function logAndNotify(
  ctx: Xrm.Events.EventContext,
  name: string,
  logger: Logger,
  err: unknown,
): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${name} failed`, { err });
  try {
    ctx.getFormContext().ui.setFormNotification(message, 'ERROR', NOTIFICATION_IDS.genericError);
  } catch {
    /* ignore */
  }
}

function logAndNotifyForm(
  formContext: Xrm.FormContext,
  name: string,
  logger: Logger,
  err: unknown,
): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${name} failed`, { err });
  try {
    formContext.ui.setFormNotification(message, 'ERROR', NOTIFICATION_IDS.genericError);
  } catch {
    /* ignore */
  }
}
