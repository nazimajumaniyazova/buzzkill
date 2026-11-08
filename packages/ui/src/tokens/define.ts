/**
 * The building block of the token source (ADR-0005, #74). A design token is one CSS custom
 * property with its resolved value. Primitives hold literal values; semantic and component
 * tokens point at a token of the layer below, and `define` copies the value through, so the
 * same object serves the generated stylesheet and code that has no stylesheet, such as the
 * canvas drawing code of the shell.
 */
export interface Token<TName extends string = string> {
  /** The custom property with its leading dashes: `--color-surface`. */
  readonly name: TName;
  /** The resolved value, valid in CSS and, for a color, on a canvas. */
  readonly value: string;
  /** The token one layer down that this one is defined over; absent on a primitive. */
  readonly ref?: Token;
}

/** The source of one group: nested keys down to literal values or tokens of a lower layer. */
export interface TokenSource {
  readonly [key: string]: string | Token | TokenSource;
}

/** Tokens as `define` returns them: the shape of the source with a `Token` at every leaf. */
export interface TokenGroup {
  readonly [key: string]: Token | TokenGroup;
}

/** `surfaceRaised` to `surface-raised`; digits and lowercase letters stay as they are. */
export type Kebab<
  S extends string,
  Acc extends string = '',
> = S extends `${infer Head}${infer Rest}`
  ? Kebab<Rest, `${Acc}${Head extends Lowercase<Head> ? Head : `-${Lowercase<Head>}`}`>
  : Acc;

/** The type of `define(prefix, source)`: every leaf is a `Token` named after its path. */
export type Defined<TSource, TPrefix extends string> = {
  readonly [K in keyof TSource & (string | number)]: TSource[K] extends string | Token
    ? Token<`${TPrefix}-${Kebab<`${K}`>}`>
    : TSource[K] extends TokenSource
      ? Defined<TSource[K], `${TPrefix}-${Kebab<`${K}`>}`>
      : never;
};

/** `lineHeight` to `line-height`. */
export function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Whether `value` is a token rather than a group of tokens or a literal value. */
export function isToken(value: unknown): value is Token {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { readonly name?: unknown; readonly value?: unknown };
  return (
    typeof candidate.name === 'string' &&
    candidate.name.startsWith('--') &&
    typeof candidate.value === 'string'
  );
}

/**
 * Builds the tokens of one group. The custom property of a leaf is the kebab-case path from
 * the prefix: `define('color', { surfaceRaised: ... })` names `--color-surface-raised`. A leaf
 * that is a token of a lower layer keeps the link in `ref`, which the stylesheet renders as a
 * `var()` reference.
 */
export function define<const TSource extends TokenSource, TPrefix extends string>(
  prefix: TPrefix,
  source: TSource,
): Defined<TSource, `--${Kebab<TPrefix>}`> {
  // The mapped type spells out what `build` does with the same keys and names.
  return build(source, `--${kebab(prefix)}`) as Defined<TSource, `--${Kebab<TPrefix>}`>;
}

function build(source: TokenSource, prefix: string): TokenGroup {
  const group: Record<string, Token | TokenGroup> = {};
  for (const [key, leaf] of Object.entries(source)) {
    const name = `${prefix}-${kebab(key)}`;
    if (typeof leaf === 'string') {
      group[key] = { name, value: leaf };
    } else if (isToken(leaf)) {
      group[key] = { name, value: leaf.value, ref: leaf };
    } else {
      group[key] = build(leaf, name);
    }
  }
  return group;
}

/** Every token of a group, depth first, in definition order. */
export function collect(group: TokenGroup): readonly Token[] {
  const tokens: Token[] = [];
  for (const member of Object.values(group)) {
    if (isToken(member)) {
      tokens.push(member);
    } else {
      tokens.push(...collect(member));
    }
  }
  return tokens;
}
