/** Joins class names and skips the empty ones: `cx(styles.stack, className)`. */
export function cx(...parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ');
}
