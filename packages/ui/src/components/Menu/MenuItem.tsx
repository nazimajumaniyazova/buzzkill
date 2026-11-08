import { type JSX, type KeyboardEvent, type ReactNode, useContext } from 'react';

import { cx } from '../../utils/cx';
import { MenuContext } from './menu-context';
import styles from './MenuItem.module.css';

export interface MenuItemProps {
  /** Called when the item is activated by click, Enter or Space; the menu then closes. */
  readonly onSelect?: () => void;
  /** A disabled item stays in the list and reachable, so it can be discovered, but does nothing. */
  readonly disabled?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * One command of a `Menu`. The `Menu` moves focus between items with a roving tabindex; the item
 * only reacts to activation.
 */
export function MenuItem({
  onSelect,
  disabled = false,
  className,
  children,
}: MenuItemProps): JSX.Element {
  const menu = useContext(MenuContext);

  const activate = (): void => {
    if (disabled) {
      return;
    }
    onSelect?.();
    menu?.close(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  };

  return (
    <div
      role="menuitem"
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      className={cx(styles.item, className)}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
