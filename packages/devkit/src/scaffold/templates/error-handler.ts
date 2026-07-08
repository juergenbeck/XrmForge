/**
 * Unified error handling for D365 form event handlers and ribbon commands.
 * Wraps sync and async handlers with try/catch: form handlers and form commands
 * show a form notification, subgrid commands an app-level notification banner.
 */
import type { Logger } from './logger.js';
import { NOTIFICATION_IDS } from './constants.js';
import { FormNotificationLevel, AppNotificationLevel, addAppNotification } from '@xrmforge/helpers';

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
 * Wrap a ribbon command handler (form context) with error handling.
 *
 * Unlike wrapHandler, this accepts a FormContext directly (not an EventContext),
 * which is the calling convention for ribbon/command bar handlers.
 *
 * Pass extra ribbon command parameters via the TArgs type parameter so they stay
 * typed end to end (e.g. `wrapCommand<[boolean]>(...)` for a handler that takes a
 * flag after the form context). TArgs defaults to `[]` (no extra parameters).
 *
 * For commands registered on a subgrid (the PrimaryControl may be a GridControl,
 * not a FormContext) use {@link wrapGridCommand} instead.
 *
 * @typeParam TArgs - Tuple of extra parameters passed after the form context
 * @param name - Handler name for logging
 * @param logger - Logger instance for error reporting
 * @param handler - The actual command handler function
 */
export function wrapCommand<TArgs extends unknown[] = []>(
  name: string,
  logger: Logger,
  handler: (formContext: Xrm.FormContext, ...args: TArgs) => unknown,
): (formContext: Xrm.FormContext, ...args: TArgs) => unknown {
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

/**
 * Wrap a ribbon command handler whose PrimaryControl can be a subgrid.
 *
 * Commands registered on a subgrid (or on both a form and a subgrid) receive a
 * `GridControl` as the first argument when fired from the grid, plus the selected
 * record ids. A `GridControl` has no form `ui`, so a form notification cannot be
 * shown - this variant reports errors via the logger and an app-level banner
 * ({@link addAppNotification}) that works independently of the form context.
 *
 * TArgs defaults to `[string[]]` (the selected record ids that D365 passes as the
 * SelectedControlSelectedItemIds command parameter).
 *
 * @typeParam TArgs - Tuple of extra parameters passed after the primary control
 * @param name - Handler name for logging
 * @param logger - Logger instance for error reporting
 * @param handler - The actual command handler function
 */
export function wrapGridCommand<TArgs extends unknown[] = [string[]]>(
  name: string,
  logger: Logger,
  handler: (primaryControl: Xrm.FormContext | Xrm.Controls.GridControl, ...args: TArgs) => unknown,
): (primaryControl: Xrm.FormContext | Xrm.Controls.GridControl, ...args: TArgs) => unknown {
  return (primaryControl, ...args) => {
    try {
      const result = handler(primaryControl, ...args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((err: unknown) => {
          logAndNotifyApp(name, logger, err);
        });
      }
      return result;
    } catch (err: unknown) {
      logAndNotifyApp(name, logger, err);
    }
  };
}

/**
 * Wrap an HTML WebResource entry point (`init`) with error handling.
 *
 * An embedded HTML WebResource has no form `ui` and should not spam the app-level
 * notification banner (one per embedded frame). Errors are logged and shown in a
 * local DOM element on the WebResource's own page: the first of `errorTarget`,
 * `#error`, `#message`, or `document.body` that exists.
 *
 * The entry point becomes:
 * `export const init = wrapWebResource('MyApp.ShowImages.init', logger, async () => { ... });`
 *
 * @param name - WebResource name for logging (e.g. 'MyApp.ShowImages.init')
 * @param logger - Logger instance for error reporting
 * @param init - The WebResource init function (sync or async)
 * @param options - Optional settings; `errorTarget` is a CSS selector for the element
 *   that receives the error text (default: `#error`, then `#message`, then `document.body`)
 */
export function wrapWebResource(
  name: string,
  logger: Logger,
  init: () => unknown,
  options: { errorTarget?: string } = {},
): () => unknown {
  return () => {
    try {
      const result = init();
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).catch((err: unknown) => {
          logAndShowInPage(name, logger, err, options.errorTarget);
        });
      }
      return result;
    } catch (err: unknown) {
      logAndShowInPage(name, logger, err, options.errorTarget);
    }
  };
}

/**
 * Wrap a ribbon Enable Rule (a custom JavaScript rule that decides whether a
 * command button is shown/enabled) with error handling.
 *
 * An Enable Rule is fundamentally different from a command: the ribbon evaluates
 * it SYNCHRONOUSLY on every refresh and uses its return value to decide button
 * visibility/enablement. It must therefore:
 * - be synchronous and return a real `boolean`. An `async` rule returns a Promise,
 *   which the ribbon always treats as truthy, so the button is permanently shown
 *   (a subtle, common legacy bug). Do the role/attribute reads synchronously.
 * - fail CLOSED: on error return `false` (hide/disable the button) instead of
 *   throwing. Because it runs constantly it must NOT surface a form/app
 *   notification (that would spam a banner on every refresh) - the error is only
 *   logged.
 *
 * Pass extra ribbon rule parameters via the TArgs type parameter (TArgs defaults
 * to `[]`).
 *
 * @typeParam TArgs - Tuple of extra parameters passed after the form context
 * @param name - Rule name for logging (e.g. 'MyApp.Account.canVerify')
 * @param logger - Logger instance for error reporting
 * @param rule - The actual enable-rule predicate (must be synchronous)
 * @returns A synchronous function returning `boolean` (false on error)
 */
export function wrapEnableRule<TArgs extends unknown[] = []>(
  name: string,
  logger: Logger,
  rule: (formContext: Xrm.FormContext, ...args: TArgs) => boolean,
): (formContext: Xrm.FormContext, ...args: TArgs) => boolean {
  return (formContext, ...args) => {
    try {
      return rule(formContext, ...args);
    } catch (err: unknown) {
      logger.error(`${name} failed`, { err });
      return false;
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
    ctx.getFormContext().ui.setFormNotification(message, FormNotificationLevel.Error, NOTIFICATION_IDS.genericError);
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
    formContext.ui.setFormNotification(message, FormNotificationLevel.Error, NOTIFICATION_IDS.genericError);
  } catch {
    /* ignore */
  }
}

/**
 * Log an error and surface it as an app-level (global) notification banner.
 *
 * Used by {@link wrapGridCommand}: the PrimaryControl may be a GridControl that
 * has no form `ui`, so a form notification is not available. The app banner is
 * shown regardless of the calling control. The async banner call is
 * fire-and-forget so the command handler is not forced to be async.
 */
function logAndNotifyApp(name: string, logger: Logger, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${name} failed`, { err });
  void addAppNotification(message, AppNotificationLevel.Error).catch(() => {
    /* ignore */
  });
}

/**
 * Log an error and show it in a local DOM element on the WebResource page.
 *
 * Used by {@link wrapWebResource}: an embedded WebResource reports its own errors
 * in its own page (no form `ui`, no app-banner spam). Picks the first existing of
 * `errorTarget`, `#error`, `#message`, or `document.body`.
 */
function logAndShowInPage(name: string, logger: Logger, err: unknown, errorTarget?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`${name} failed`, { err });
  try {
    const el =
      (errorTarget ? document.querySelector(errorTarget) : null) ??
      document.querySelector('#error') ??
      document.querySelector('#message') ??
      document.body;
    if (el) el.textContent = message;
  } catch {
    /* no DOM available */
  }
}
