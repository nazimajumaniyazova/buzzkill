import { type JSX, type KeyboardEvent, type ReactNode, useId, useRef } from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import styles from './Tabs.module.css';

export interface TabItem<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly panel: ReactNode;
  readonly disabled?: boolean;
}

export type TabsActivation = 'automatic' | 'manual';

export interface TabsProps<T extends string> {
  /** Names the tab list for assistive technology. */
  readonly label: string;
  readonly items: readonly TabItem<T>[];
  /** The selected tab when the parent controls it. */
  readonly value?: T;
  /** The initial tab when the component holds the state; the first enabled tab otherwise. */
  readonly defaultValue?: T;
  /** Hears every change in both modes. */
  readonly onValueChange?: (value: T) => void;
  /**
   * `automatic`: the arrow keys select the tab they move to. `manual`: they only move focus,
   * and Enter or Space selects, which suits panels that are expensive to show.
   */
  readonly activation?: TabsActivation;
  readonly className?: string;
}

/**
 * Tabs after the WAI-ARIA pattern: a `tablist` of `tab` buttons with a roving tabindex and one
 * `tabpanel` at a time. ArrowLeft and ArrowRight move with wrap-around, Home and End jump,
 * disabled tabs are skipped. The state is held here unless the parent passes `value`.
 */
export function Tabs<T extends string>({
  label,
  items,
  value,
  defaultValue,
  onValueChange,
  activation = 'automatic',
  className,
}: TabsProps<T>): JSX.Element {
  const firstEnabled = items.find((item) => item.disabled !== true)?.value;
  const [selected, setSelected] = useControlled<T | undefined>(
    value,
    defaultValue ?? firstEnabled,
    (next) => {
      if (next !== undefined) {
        onValueChange?.(next);
      }
    },
  );
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const tabId = (item: TabItem<T>): string => `${baseId}-tab-${item.value}`;
  const panelId = (item: TabItem<T>): string => `${baseId}-panel-${item.value}`;

  // On the tab buttons rather than the list: the strict a11y lint rules accept key handlers on
  // interactive elements, and the key bubbles from the focused tab anyway.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const enabled = items.filter((item) => item.disabled !== true);
    if (enabled.length === 0) {
      return;
    }
    const focused = enabled.findIndex((item) => document.activeElement?.id === tabId(item));
    const current = focused === -1 ? 0 : focused;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = enabled.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = enabled[next];
    if (target === undefined) {
      return;
    }
    listRef.current?.querySelector<HTMLElement>(`[id="${tabId(target)}"]`)?.focus();
    if (activation === 'automatic') {
      setSelected(target.value);
    }
  };

  const active = items.find((item) => item.value === selected);

  return (
    <div className={cx(styles.tabs, className)}>
      <div ref={listRef} role="tablist" aria-label={label} className={styles.list}>
        {items.map((item) => {
          const isSelected = item.value === selected;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              id={tabId(item)}
              aria-selected={isSelected}
              aria-controls={isSelected ? panelId(item) : undefined}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              className={styles.tab}
              onClick={() => {
                setSelected(item.value);
              }}
              onKeyDown={onKeyDown}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {active !== undefined && (
        <div
          role="tabpanel"
          id={panelId(active)}
          aria-labelledby={tabId(active)}
          tabIndex={0}
          className={styles.panel}
        >
          {active.panel}
        </div>
      )}
    </div>
  );
}
