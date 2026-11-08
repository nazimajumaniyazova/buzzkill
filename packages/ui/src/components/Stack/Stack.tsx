import type { ComponentPropsWithoutRef, JSX } from 'react';

import { cx } from '../../utils/cx';
import styles from './Stack.module.css';

export type StackGap = 'sm' | 'md' | 'lg' | 'xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';

export interface StackProps extends ComponentPropsWithoutRef<'div'> {
  /** The vertical gap between the children, from the `space.stack` tokens. */
  readonly gap?: StackGap;
  /** The horizontal alignment of the children. */
  readonly align?: StackAlign;
}

/**
 * Lays its children out in a column with a token gap. It renders a `div`, so a group with a
 * meaning gets its role or semantic element from the parent or through the props.
 */
export function Stack({
  gap = 'md',
  align = 'stretch',
  className,
  ...rest
}: StackProps): JSX.Element {
  return (
    <div {...rest} className={cx(styles.stack, className)} data-gap={gap} data-align={align} />
  );
}
