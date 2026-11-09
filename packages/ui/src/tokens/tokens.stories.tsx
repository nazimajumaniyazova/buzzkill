import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, JSX, ReactNode } from 'react';

import { collect, type Token, type TokenGroup } from './define';
import { tokens } from './tokens';

/**
 * The design tokens as the stylesheet renders them: every swatch and sample reads its token
 * through `var()`, so the Theme toolbar switches the semantic colors live.
 */
const meta = {
  title: 'Tokens',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const heading: CSSProperties = { fontSize: 'var(--font-size-lg)', margin: 0 };
const section: CSSProperties = { display: 'grid', gap: 'var(--space-stack-md)' };
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-inline-lg)' };
const cell: CSSProperties = {
  padding: 'var(--space-inset-sm)',
  textAlign: 'start',
  borderBottom: '1px solid var(--color-border)',
};

function reference(token: Token): string {
  return token.ref === undefined ? token.value : `var(${token.ref.name})`;
}

function Swatch({ token, note }: { token: Token; note?: string }): JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-stack-sm)', justifyItems: 'start' }}>
      <div
        aria-hidden="true"
        style={{
          width: 96,
          height: 56,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-control)',
          background: `var(${token.name})`,
        }}
      />
      <code>{token.name}</code>
      <small>{note ?? reference(token)}</small>
    </div>
  );
}

function Swatches({ title, group }: { title: string; group: TokenGroup }): JSX.Element {
  return (
    <section style={section}>
      <h2 style={heading}>{title}</h2>
      <div style={row}>
        {collect(group).map((token) => (
          <Swatch key={token.name} token={token} />
        ))}
      </div>
    </section>
  );
}

function TokenTable({
  caption,
  group,
  sample,
}: {
  caption: string;
  group: TokenGroup;
  sample?: (token: Token) => JSX.Element;
}): JSX.Element {
  return (
    <table style={{ borderCollapse: 'collapse' }}>
      <caption style={{ ...heading, captionSide: 'top', textAlign: 'start' }}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" style={cell}>
            Token
          </th>
          <th scope="col" style={cell}>
            Value
          </th>
          {sample === undefined ? null : (
            <th scope="col" style={cell}>
              Sample
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {collect(group).map((token) => (
          <tr key={token.name}>
            <td style={cell}>
              <code>{token.name}</code>
            </td>
            <td style={cell}>{reference(token)}</td>
            {sample === undefined ? null : <td style={cell}>{sample(token)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <main style={{ display: 'grid', gap: 'var(--space-stack-xl)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>{title}</h1>
      {children}
    </main>
  );
}

export const Palette: Story = {
  render: () => (
    <Page title="Palette">
      {Object.entries(tokens.primitives.palette).map(([family, group]) => (
        <Swatches key={family} title={family} group={group} />
      ))}
    </Page>
  ),
};

export const SemanticColors: Story = {
  name: 'Semantic colors',
  render: () => {
    const { day, night } = tokens.semantic.color;
    return (
      <Page title="Semantic colors">
        <p style={{ margin: 0 }}>
          The swatches show the active theme; the notes name the primitive behind each token in the
          day and in the night theme.
        </p>
        <div style={row}>
          {collect(day).map((token, index) => (
            <Swatch
              key={token.name}
              token={token}
              note={`day ${reference(token)}, night ${reference(collect(night)[index] ?? token)}`}
            />
          ))}
        </div>
      </Page>
    );
  },
};

export const Spacing: Story = {
  render: () => (
    <Page title="Spacing">
      <TokenTable
        caption="Scale"
        group={tokens.primitives.spacing}
        sample={(token) => (
          <div
            aria-hidden="true"
            style={{ width: `var(${token.name})`, height: 16, background: 'var(--color-accent)' }}
          />
        )}
      />
      <TokenTable caption="Semantic spacing" group={tokens.semantic.space} />
    </Page>
  ),
};

export const Typography: Story = {
  render: () => (
    <Page title="Typography">
      <TokenTable
        caption="Families"
        group={tokens.primitives.font.family}
        sample={(token) => <span style={{ fontFamily: `var(${token.name})` }}>Buzzkill 3023</span>}
      />
      <TokenTable
        caption="Sizes"
        group={tokens.primitives.font.size}
        sample={(token) => <span style={{ fontSize: `var(${token.name})` }}>Buzzkill 3023</span>}
      />
      <TokenTable
        caption="Weights"
        group={tokens.primitives.font.weight}
        sample={(token) => <span style={{ fontWeight: `var(${token.name})` }}>Buzzkill 3023</span>}
      />
      <TokenTable caption="Line heights" group={tokens.primitives.font.lineHeight} />
      <TokenTable caption="Semantic fonts" group={tokens.semantic.font} />
    </Page>
  ),
};

export const ShapeAndElevation: Story = {
  name: 'Radius and shadow',
  render: () => (
    <Page title="Radius and shadow">
      <TokenTable
        caption="Radii"
        group={tokens.primitives.radius}
        sample={(token) => (
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 40,
              border: '1px solid var(--color-border)',
              borderRadius: `var(${token.name})`,
              background: 'var(--color-surface)',
            }}
          />
        )}
      />
      <TokenTable
        caption="Shadows"
        group={tokens.primitives.shadow}
        sample={(token) => (
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 40,
              borderRadius: 'var(--radius-control)',
              boxShadow: `var(${token.name})`,
              background: 'var(--color-surface)',
            }}
          />
        )}
      />
      <TokenTable caption="Semantic radii" group={tokens.semantic.radius} />
      <TokenTable caption="Semantic shadows" group={tokens.semantic.shadow} />
    </Page>
  ),
};

export const Motion: Story = {
  render: () => (
    <Page title="Motion">
      <TokenTable caption="Durations" group={tokens.primitives.duration} />
      <TokenTable caption="Easings" group={tokens.primitives.easing} />
      <TokenTable caption="Semantic motion" group={tokens.semantic.motion} />
      <TokenTable caption="Under prefers-reduced-motion" group={tokens.preferences.reducedMotion} />
    </Page>
  ),
};

export const Layers: Story = {
  render: () => (
    <Page title="Layers">
      <TokenTable caption="Stacking order" group={tokens.primitives.layer} />
    </Page>
  ),
};

export const Components: Story = {
  render: () => (
    <Page title="Components">
      <TokenTable caption="Button" group={tokens.components.button} />
      <TokenTable caption="Dialog" group={tokens.components.dialog} />
      <TokenTable caption="Menu" group={tokens.components.menu} />
      <TokenTable caption="Switch" group={tokens.components.switch} />
      <TokenTable caption="Slider" group={tokens.components.slider} />
      <TokenTable caption="Radio" group={tokens.components.radio} />
      <TokenTable caption="Tabs" group={tokens.components.tabs} />
      <TokenTable caption="Toast" group={tokens.components.toast} />
    </Page>
  ),
};
