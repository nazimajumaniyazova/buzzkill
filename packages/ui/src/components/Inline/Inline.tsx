import type { ComponentPropsWithoutRef, JSX } from 'react';

import { cx } from '../../utils/cx';
import styles from './Inline.module.css';

export type InlineGap = 'sm' | 'md' | 'lg' | 'xl';
export type InlineAlign = 'start' | 'center' | 'end' | 'baseline';
export type InlineJustify = 'start' | 'center' | 'end' | 'between';

export interface InlineProps extends ComponentPropsWithoutRef<'div'> {
  /** The gap between the children, in both directions, from the `space.inline` tokens. */
  readonly gap?: InlineGap;
  /** The vertical alignment of the children within a line. */
  readonly align?: InlineAlign;
  /** How the children are distributed along a line. */
  readonly justify?: InlineJustify;
}

/**
 * Lays its children out in a row with a token gap and wraps them onto new lines when the width
 * runs out. It renders a `div`, like `Stack`.
 */
export function Inline({
  gap = 'md',
  align = 'center',
  justify = 'start',
  className,
  ...rest
}: InlineProps): JSX.Element {
  return (
    <div
      {...rest}
      className={cx(styles.inline, className)}
      data-gap={gap}
      data-align={align}
      data-justify={justify}
    />
  );
}
