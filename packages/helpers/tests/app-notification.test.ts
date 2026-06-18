import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addAppNotification } from '../src/app-notification.js';
import { AppNotificationLevel } from '../src/xrm-constants.js';

const addGlobalNotification = vi.fn();

beforeEach(() => {
  addGlobalNotification.mockReset().mockResolvedValue('notif-1');
  (globalThis as Record<string, unknown>).Xrm = { App: { addGlobalNotification } };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).Xrm;
});

describe('addAppNotification', () => {
  it('builds a banner notification with the given level and message, returns the id', async () => {
    const id = await addAppNotification('Saved', AppNotificationLevel.Success);

    expect(id).toBe('notif-1');
    const arg = addGlobalNotification.mock.calls[0][0];
    expect(arg.type).toBe(2); // banner
    expect(arg.level).toBe(1); // AppNotificationLevel.Success
    expect(arg.message).toBe('Saved');
    expect(arg.showCloseButton).toBe(false);
    expect(arg.action).toBeUndefined();
  });

  it('honours the showCloseButton option and maps the level', async () => {
    await addAppNotification('Careful', AppNotificationLevel.Warning, { showCloseButton: true });

    const arg = addGlobalNotification.mock.calls[0][0];
    expect(arg.level).toBe(3); // AppNotificationLevel.Warning
    expect(arg.showCloseButton).toBe(true);
  });

  it('includes an action only when provided', async () => {
    const action = { actions: [], message: 'Open' } as unknown as Xrm.App.Action;
    await addAppNotification('With action', AppNotificationLevel.Information, { action });

    const arg = addGlobalNotification.mock.calls[0][0];
    expect(arg.action).toBe(action);
    expect(arg.level).toBe(4); // AppNotificationLevel.Information
  });
});
