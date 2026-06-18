/**
 * @xrmforge/helpers - App-level (global) notification helper
 *
 * Wraps Xrm.App.addGlobalNotification and hides the XrmEnum.AppNotificationLevel
 * runtime gap (XrmEnum const enums do not exist at runtime; see AGENT.md pitfall).
 */

import type { AppNotificationLevel } from './xrm-constants.js';

/** Banner is the only supported global-notification type. */
const NOTIFICATION_TYPE_BANNER = 2;

/** Options for {@link addAppNotification}. */
export interface AppNotificationOptions {
  /** Show a close (X) button on the banner (default: false). */
  showCloseButton?: boolean;
  /** Optional action button. */
  action?: Xrm.App.Action;
}

/**
 * Show a global app-level notification banner and return its id.
 *
 * Pass an {@link AppNotificationLevel} (Success/Error/Warning/Information). The
 * cast to the @types/xrm `XrmEnum.AppNotificationLevel` (which has no runtime
 * representation) happens here, once, instead of at every call site.
 *
 * @param message - The banner message
 * @param level - The notification level
 * @param options - Optional banner settings
 * @returns The created notification id (pass to `Xrm.App.clearGlobalNotification`)
 *
 * @example
 * const id = await addAppNotification(lang.saved, AppNotificationLevel.Success, { showCloseButton: true });
 */
export async function addAppNotification(
  message: string,
  level: AppNotificationLevel,
  options: AppNotificationOptions = {},
): Promise<string> {
  const notification: Xrm.App.Notification = {
    type: NOTIFICATION_TYPE_BANNER as Xrm.App.Notification['type'],
    // XrmEnum.AppNotificationLevel has no runtime value; AppNotificationLevel carries
    // the same numbers. Cast at this single boundary to satisfy the typings.
    level: level as unknown as XrmEnum.AppNotificationLevel,
    message,
    showCloseButton: options.showCloseButton ?? false,
    ...(options.action ? { action: options.action } : {}),
  };
  return Xrm.App.addGlobalNotification(notification);
}
