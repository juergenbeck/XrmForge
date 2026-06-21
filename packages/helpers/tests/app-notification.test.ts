import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { addAppNotification, clearAppNotification } from '../src/app-notification.js';
import { AppNotificationLevel } from '../src/xrm-constants.js';

const addGlobalNotification = vi.fn();
const clearGlobalNotification = vi.fn();

beforeEach(() => {
  addGlobalNotification.mockReset().mockResolvedValue('notif-1');
  clearGlobalNotification.mockReset().mockResolvedValue('notif-1');
  (globalThis as Record<string, unknown>).Xrm = { App: { addGlobalNotification, clearGlobalNotification } };
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

  it('auto-clears the banner after autoHideMs and returns the id', async () => {
    vi.useFakeTimers();
    try {
      const id = await addAppNotification('Saved', AppNotificationLevel.Success, { autoHideMs: 4000 });

      expect(id).toBe('notif-1');
      expect(clearGlobalNotification).not.toHaveBeenCalled(); // not before the delay elapses

      vi.advanceTimersByTime(4000);
      expect(clearGlobalNotification).toHaveBeenCalledWith('notif-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not schedule an auto-hide when autoHideMs is omitted or <= 0', async () => {
    vi.useFakeTimers();
    try {
      await addAppNotification('Stay', AppNotificationLevel.Information);
      await addAppNotification('Stay', AppNotificationLevel.Information, { autoHideMs: 0 });

      vi.advanceTimersByTime(100000);
      expect(clearGlobalNotification).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('clearAppNotification', () => {
  it('clears the banner via Xrm.App.clearGlobalNotification with the given id', async () => {
    await clearAppNotification('notif-1');

    expect(clearGlobalNotification).toHaveBeenCalledTimes(1);
    expect(clearGlobalNotification).toHaveBeenCalledWith('notif-1');
  });

  it('clears the id returned by addAppNotification (round-trip)', async () => {
    const id = await addAppNotification('Polling', AppNotificationLevel.Information);
    await clearAppNotification(id);

    expect(clearGlobalNotification).toHaveBeenCalledWith('notif-1');
  });

  it('does not throw when Xrm.App is undefined at runtime (mobile/older UCI)', async () => {
    (globalThis as Record<string, unknown>).Xrm = {};
    await expect(clearAppNotification('notif-1')).resolves.toBeUndefined();
  });

  it('does not throw when clearGlobalNotification is missing', async () => {
    (globalThis as Record<string, unknown>).Xrm = { App: {} };
    await expect(clearAppNotification('notif-1')).resolves.toBeUndefined();
  });
});
