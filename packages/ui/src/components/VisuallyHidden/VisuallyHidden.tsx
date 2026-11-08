import type { ComponentPropsWithoutRef, JSX } from 'react';

import { cx } from '../../utils/cx';
import styles from './VisuallyHidden.module.css';

export type VisuallyHiddenProps = ComponentPropsWithoutRef<'span'>;

/**
 * Text for assistive technology only: it stays in the accessibility tree and in the reading
 * order, but takes no visible space. For labels that sighted users get from the layout or an
 * icon.
 */
export function VisuallyHidden({ className, ...rest }: VisuallyHiddenProps): JSX.Element {
  return <span {...rest} className={cx(styles.visuallyHidden, className)} />;
}
