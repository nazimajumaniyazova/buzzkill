import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { RadioGroup } from './RadioGroup';

const HEROES = [
  { value: 'male', label: 'Mike' },
  { value: 'female', label: 'Julie' },
  { value: 'robot', label: 'Unit 7', disabled: true },
] as const;

describe('RadioGroup', () => {
  it('is a group named by its legend with one radio per option, none chosen by default', () => {
    render(<RadioGroup label="Hero" name="hero" options={HEROES} />);

    expect(screen.getByRole('group', { name: 'Hero' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('name'))).toEqual(['hero', 'hero', 'hero']);
    expect(screen.getByRole('radio', { name: 'Mike' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Julie' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Unit 7' })).toBeDisabled();
  });

  it('starts with defaultValue and changes on click, reporting the value', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        label="Hero"
        name="hero"
        options={HEROES}
        defaultValue="male"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Julie' }));
    expect(screen.getByRole('radio', { name: 'Julie' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Mike' })).not.toBeChecked();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('female');
  });

  it('moves and chooses with the arrow keys inside the group', async () => {
    const user = userEvent.setup();
    render(<RadioGroup label="Hero" name="hero" options={HEROES} defaultValue="male" />);

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Mike' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Julie' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Julie' })).toBeChecked();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();
  });

  it('follows the parent when controlled', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <RadioGroup
        label="Hero"
        name="hero"
        options={HEROES}
        value="male"
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole('radio', { name: 'Julie' }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('female');
    expect(screen.getByRole('radio', { name: 'Mike' })).toBeChecked();

    rerender(
      <RadioGroup
        label="Hero"
        name="hero"
        options={HEROES}
        value="female"
        onValueChange={onValueChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Julie' })).toBeChecked();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <RadioGroup
        label="Hero"
        name="hero"
        options={HEROES}
        defaultValue="male"
        orientation="vertical"
      />,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
