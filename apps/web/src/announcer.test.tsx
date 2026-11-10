import { act, render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';

import { AnnouncerProvider, createAnnouncer, useAnnounce } from './announcer';

function setup() {
  const announcer = createAnnouncer();
  const view = render(
    <AnnouncerProvider announcer={announcer}>
      <p>The page</p>
    </AnnouncerProvider>,
  );
  const [polite, assertive] = screen.getAllByRole('log');
  if (polite === undefined || assertive === undefined) {
    throw new Error('two live regions expected');
  }
  const say = (...args: Parameters<typeof announcer.announce>): void => {
    act(() => {
      announcer.announce(...args);
    });
  };
  return { ...view, polite, assertive, say };
}

describe('AnnouncerProvider', () => {
  it('keeps a polite and an assertive live region in the page, empty at first', async () => {
    const { container, polite, assertive } = setup();

    expect(screen.getByText('The page')).toBeInTheDocument();
    expect(polite).toHaveAttribute('aria-live', 'polite');
    expect(assertive).toHaveAttribute('aria-live', 'assertive');
    expect(polite).toBeEmptyDOMElement();
    expect(assertive).toBeEmptyDOMElement();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('says a message politely unless told otherwise, and empties the other region', () => {
    const { polite, assertive, say } = setup();

    say('Level 1. Go!');
    expect(polite).toHaveTextContent('Level 1. Go!');
    expect(assertive).toBeEmptyDOMElement();

    say('Game over. Score: 42.', 'assertive');
    expect(assertive).toHaveTextContent('Game over. Score: 42.');
    expect(polite).toBeEmptyDOMElement();
  });

  it('puts the same words said twice in a new node, so they are read twice', () => {
    const { polite, say } = setup();

    say('Hit! 2 lives left.');
    const first = within(polite).getByText('Hit! 2 lives left.');
    say('Hit! 2 lives left.');

    expect(within(polite).getByText('Hit! 2 lives left.')).not.toBe(first);
  });
});

describe('useAnnounce', () => {
  it('says nothing, and breaks nothing, without a provider', () => {
    function Speaker(): JSX.Element {
      const announce = useAnnounce();
      announce('Nobody hears this');
      return <p>Alone</p>;
    }

    render(<Speaker />);

    expect(screen.getByText('Alone')).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });
});
