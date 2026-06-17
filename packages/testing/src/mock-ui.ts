/**
 * @xrmforge/testing - MockUi
 *
 * Mock implementation of Xrm.Ui.
 * Tracks form notifications for assertions.
 */

import type { MockTabConfig, MockSectionConfig } from './types.js';

/**
 * Default values matching @xrmforge/helpers const enums.
 * Cannot import const enums across module boundaries with isolatedModules,
 * so we mirror the values here with semantic names.
 */
const DEFAULT_DISPLAY_STATE: Xrm.DisplayState = 'expanded'; // DisplayState.Expanded

/** Represents a form-level notification with message and severity level. */
export interface FormNotification {
  /** The notification message text. */
  message: string;
  /** The severity level ('INFO', 'WARNING', or 'ERROR'). */
  level: string;
}

/** Build a stateful section mock that tracks setVisible/setLabel. */
function buildSection(config: MockSectionConfig): Xrm.Controls.Section {
  let visible = config.visible ?? true;
  let label = config.label ?? config.name;
  const section = {
    getName: () => config.name,
    getVisible: () => visible,
    setVisible: (v: boolean) => {
      visible = v;
    },
    getLabel: () => label,
    setLabel: (l: string) => {
      label = l;
    },
    getParent: () => ({}) as Xrm.Controls.Tab,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
    controls: { forEach: () => {}, get: (() => null) as any, getLength: () => 0 },
  };
  return section as unknown as Xrm.Controls.Section;
}

/** Build a stateful tab mock with a section collection; tracks visibility/state. */
function buildTab(config: MockTabConfig): Xrm.Controls.Tab {
  let visible = config.visible ?? true;
  let displayState: Xrm.DisplayState = config.displayState ?? DEFAULT_DISPLAY_STATE;
  let label = config.label ?? config.name;

  const sections = new Map<string, Xrm.Controls.Section>();
  for (const s of config.sections ?? []) {
    const sectionConfig: MockSectionConfig = typeof s === 'string' ? { name: s } : s;
    sections.set(sectionConfig.name, buildSection(sectionConfig));
  }
  const getOrCreateSection = (name: string): Xrm.Controls.Section => {
    let section = sections.get(name);
    if (!section) {
      section = buildSection({ name });
      sections.set(name, section);
    }
    return section;
  };

  const sectionCollection = {
    forEach: (callback: (section: Xrm.Controls.Section, index: number) => void) =>
      [...sections.values()].forEach(callback),
    get: ((selector?: string | number) => {
      if (typeof selector === 'string') return getOrCreateSection(selector);
      if (typeof selector === 'number') return [...sections.values()][selector] ?? null;
      return [...sections.values()];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
    }) as any,
    getLength: () => sections.size,
  };

  const tab = {
    getName: () => config.name,
    getVisible: () => visible,
    setVisible: (v: boolean) => {
      visible = v;
    },
    getDisplayState: () => displayState,
    setDisplayState: (s: Xrm.DisplayState) => {
      displayState = s;
    },
    getLabel: () => label,
    setLabel: (l: string) => {
      label = l;
    },
    setFocus: () => {},
    addTabStateChange: () => {},
    removeTabStateChange: () => {},
    getParent: () => ({}) as Xrm.Ui,
    sections: sectionCollection,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
    controls: { forEach: () => {}, get: (() => null) as any, getLength: () => 0 },
  };
  return tab as unknown as Xrm.Controls.Tab;
}

/**
 * Mock implementation of {@link Xrm.Ui} for unit testing.
 *
 * Tracks form-level notifications and provides stub implementations
 * for tabs, close, and viewport methods.
 *
 * @example
 * ```typescript
 * const mock = createFormMock<AccountMainForm>({ name: 'Contoso' });
 * mock.ui.setFormNotification('Saved', 'INFO', 'save-ok');
 * expect(mock.ui.getFormNotification('save-ok')?.message).toBe('Saved');
 * ```
 */
export class MockUi {
  private _notifications: Map<string, FormNotification> = new Map();

  /** Seeded tabs (createFormMock options.tabs); tabs are also created on demand. */
  private _tabs: Map<string, Xrm.Controls.Tab> = new Map();

  /**
   * Seed the tab/section structure so ui.tabs.get() (all tabs), forEach, and
   * cross-tab section visibility become testable. Called by createFormMock.
   */
  seedTabs(configs: MockTabConfig[]): void {
    for (const config of configs) {
      this._tabs.set(config.name, buildTab(config));
    }
  }

  private getOrCreateTab(name: string): Xrm.Controls.Tab {
    let tab = this._tabs.get(name);
    if (!tab) {
      tab = buildTab({ name });
      this._tabs.set(name, tab);
    }
    return tab;
  }

  /**
   * Sets a form-level notification.
   *
   * @param message - Notification message text
   * @param level - Severity level ('INFO', 'WARNING', or 'ERROR')
   * @param uniqueId - Unique identifier for the notification
   * @returns Always true (success)
   */
  setFormNotification(message: string, level: string, uniqueId: string): boolean {
    this._notifications.set(uniqueId, { message, level });
    return true;
  }

  /**
   * Clears a form-level notification.
   *
   * @param uniqueId - Unique identifier of the notification to clear
   * @returns Always true (success)
   */
  clearFormNotification(uniqueId: string): boolean {
    this._notifications.delete(uniqueId);
    return true;
  }

  /** Get a specific notification by ID (for assertions) */
  getFormNotification(uniqueId: string): FormNotification | undefined {
    return this._notifications.get(uniqueId);
  }

  /** Get all notifications (for assertions) */
  getFormNotifications(): ReadonlyMap<string, FormNotification> {
    return this._notifications;
  }

  /**
   * Mock tab collection. Supports the overloaded `get`:
   * - `get()` (no argument) returns all (seeded or on-demand) tabs as an array
   * - `get(name)` returns the named tab, creating a stateful one on demand
   * - `get(index)` returns the tab at that position
   * `forEach`/`getLength` iterate the known tabs. Tabs and their sections track
   * `setVisible`/`setDisplayState` so cross-tab logic is assertable.
   */
  tabs = {
    get: ((selector?: string | number): Xrm.Controls.Tab | Xrm.Controls.Tab[] | null => {
      if (typeof selector === 'string') return this.getOrCreateTab(selector);
      if (typeof selector === 'number') return [...this._tabs.values()][selector] ?? null;
      return [...this._tabs.values()];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Xrm.Collection overloaded get()
    }) as any,
    forEach: (callback: (tab: Xrm.Controls.Tab, index: number) => void): void =>
      [...this._tabs.values()].forEach(callback),
    getLength: (): number => this._tabs.size,
  };

  /** Closes the form (no-op in this mock). */
  close(): void {
    // no-op
  }

  /** Returns the form type (always 2 / Update in this mock). */
  getFormType(): XrmEnum.FormType {
    return 2 as XrmEnum.FormType; // XrmEnum.FormType.Update (const enum, cannot import with isolatedModules)
  }

  /** Returns the viewport height in pixels (always 800 in this mock). */
  getViewPortHeight(): number {
    return 800;
  }

  /** Returns the viewport width in pixels (always 1200 in this mock). */
  getViewPortWidth(): number {
    return 1200;
  }

  /**
   * Refreshes the command bar / ribbon (no-op in this mock).
   *
   * @param _refreshAll - Whether to refresh all ribbons
   */
  refreshRibbon(_refreshAll?: boolean): void {
    // no-op
  }

  /**
   * Sets the form entity name (no-op in this mock).
   *
   * @param _name - Entity name to set
   */
  setFormEntityName(_name: string): void {
    // no-op
  }
}
