import {
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { cx } from '../../utils/cx';
import { useControlled } from '../../utils/use-controlled';
import { Button, type ButtonSize, type ButtonVariant } from '../Button/Button';
import styles from './Menu.module.css';
import { MenuContext, type MenuContextValue } from './menu-context';

export interface MenuProps {
  /** The text of the trigger button; it names the menu as well. */
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** The open state when the parent controls it. */
  readonly open?: boolean;
  /** The initial open state when the menu holds the state itself. */
  readonly defaultOpen?: boolean;
  /** Hears every change in both modes. */
  readonly onOpenChange?: (open: boolean) => void;
  readonly className?: string;
  /** The `MenuItem` elements. */
  readonly children: ReactNode;
}

type Edge = 'first' | 'last';

function itemsOf(menu: HTMLElement | null): HTMLElement[] {
  return menu === null ? [] : Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

/** Roving tabindex: the focused item is the one Tab would reach, the others are skipped. */
function focusItem(items: readonly HTMLElement[], index: number): void {
  const target = items.at(index);
  if (target === undefined) {
    return;
  }
  for (const item of items) {
    item.tabIndex = item === target ? 0 : -1;
  }
  target.focus();
}

/**
 * A menu button after the WAI-ARIA pattern: a trigger with `aria-haspopup` and `aria-expanded`,
 * a `role="menu"` container of `MenuItem`s with a roving tabindex. Arrows move with wrap-around, Home
 * and End jump, a typed letter jumps to the next item starting with it, Enter and Space
 * activate the item, Escape closes and returns focus to the trigger, a press outside or Tab
 * closes. The open state is held here unless the parent passes `open`.
 */
export function Menu({
  label,
  variant = 'secondary',
  size = 'md',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
}: MenuProps): JSX.Element {
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const triggerId = useId();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  /** Which item takes focus when the menu opens: ArrowUp asks for the last one. */
  const [edge, setEdge] = useState<Edge>('first');

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) {
        triggerRef.current?.focus();
      }
    },
    [setOpen],
  );

  const openAt = (where: Edge): void => {
    const items = itemsOf(menuRef.current);
    if (open && items.length > 0) {
      focusItem(items, where === 'first' ? 0 : items.length - 1);
      return;
    }
    setEdge(where);
    setOpen(true);
  };

  // Focus the first or last item once the list is in the DOM.
  useEffect(() => {
    if (!open) {
      return;
    }
    const items = itemsOf(menuRef.current);
    focusItem(items, edge === 'first' ? 0 : items.length - 1);
  }, [open, edge]);

  // A press outside closes the menu, and so does focus leaving the root (Tab moves it on by
  // itself); in both cases focus stays where the user put it.
  useEffect(() => {
    const root = rootRef.current;
    if (!open || root === null) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
      }
    };
    const onFocusOut = (event: FocusEvent): void => {
      if (!(event.relatedTarget instanceof Node && root.contains(event.relatedTarget))) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [open, setOpen]);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    // Enter and Space reach `onClick` through the button itself.
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openAt('first');
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openAt('last');
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const items = itemsOf(menuRef.current);
    if (items.length === 0) {
      return;
    }
    const current = items.findIndex((item) => item === document.activeElement);
    const move = (index: number): void => {
      event.preventDefault();
      focusItem(items, (index + items.length) % items.length);
    };
    switch (event.key) {
      case 'ArrowDown':
        move(current + 1);
        break;
      case 'ArrowUp':
        move(current - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      default:
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          const letter = event.key.toLowerCase();
          const after = [...items.slice(current + 1), ...items.slice(0, current + 1)];
          const match = after.find((item) =>
            item.textContent.trim().toLowerCase().startsWith(letter),
          );
          if (match !== undefined) {
            event.preventDefault();
            focusItem(items, items.indexOf(match));
          }
        }
    }
  };

  const context = useMemo<MenuContextValue>(() => ({ close }), [close]);

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <Button
        ref={triggerRef}
        id={triggerId}
        variant={variant}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            openAt('first');
          }
        }}
        onKeyDown={onTriggerKeyDown}
      >
        {label}
      </Button>
      {open && (
        <MenuContext value={context}>
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-labelledby={triggerId}
            tabIndex={-1}
            className={styles.menu}
            onKeyDown={onMenuKeyDown}
          >
            {children}
          </div>
        </MenuContext>
      )}
    </div>
  );
}
