import {
  type JSX,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from 'react';

import { cx } from '../../utils/cx';
import { IconButton } from '../Button/IconButton';
import { Stack } from '../Stack/Stack';
import styles from './Dialog.module.css';

export interface DialogProps {
  /** Whether the dialog is shown. The parent owns it; the dialog asks to close through `onClose`. */
  readonly open: boolean;
  /** Called when the user asks to close: Escape or the close button. */
  readonly onClose: () => void;
  /** The title. It labels the dialog for assistive technology. */
  readonly title: string;
  /** Text under the title, linked as the accessible description. */
  readonly description?: string;
  /** The element to focus on open; otherwise the first focusable element, or the dialog itself. */
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  /** The accessible name of the close button in the corner. */
  readonly closeLabel?: string;
  readonly className?: string;
  readonly children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Opens the native modal where the browser has it: the dialog joins the top layer, the rest of
 * the page becomes inert and focus cannot leave. jsdom, where the unit tests run, has no
 * `showModal` yet, so there the dialog is only marked open.
 */
function showModal(dialog: HTMLDialogElement): void {
  const native = dialog as Partial<Pick<HTMLDialogElement, 'showModal'>>;
  if (native.showModal === undefined) {
    dialog.setAttribute('open', '');
  } else if (!dialog.open) {
    native.showModal.call(dialog);
  }
}

function closeModal(dialog: HTMLDialogElement): void {
  const native = dialog as Partial<Pick<HTMLDialogElement, 'close'>>;
  if (native.close === undefined) {
    dialog.removeAttribute('open');
  } else if (dialog.open) {
    native.close.call(dialog);
  }
}

/**
 * A modal dialog after the WAI-ARIA pattern on the native `dialog` element: labelled by its
 * title, `aria-modal`, focus moves inside on open and back to the opener on close, Escape asks
 * to close. The close button sits last in the DOM, so Tab visits the content first.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  initialFocusRef,
  closeLabel = 'Close',
  className,
  children,
}: DialogProps): JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) {
      return undefined;
    }
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    showModal(dialog);
    const target =
      initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    target.focus();
    return () => {
      closeModal(dialog);
      opener?.focus();
    };
  }, [open, initialFocusRef]);

  // Escape asks the parent to close. The listener sits on the document: while a native modal is
  // open the rest of the page is inert, and focus may rest on the browser's own UI, from where
  // the key would not reach the element. Should the browser close the element itself all the
  // same (Chromium does on a repeated Escape), the `close` event tells the parent.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || dialog === null) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    const onNativeClose = (): void => {
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('close', onNativeClose);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('close', onNativeClose);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  // The browser's own Escape handling would close the element behind the parent's back.
  const onCancel = (event: SyntheticEvent<HTMLDialogElement>): void => {
    event.preventDefault();
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.dialog, className)}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      tabIndex={-1}
      onCancel={onCancel}
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {description !== undefined && (
            <p id={descriptionId} className={styles.description}>
              {description}
            </p>
          )}
        </Stack>
        {children}
      </Stack>
      <IconButton
        className={styles.close}
        variant="secondary"
        size="sm"
        label={closeLabel}
        onClick={onClose}
      >
        ✕
      </IconButton>
    </dialog>
  );
}
