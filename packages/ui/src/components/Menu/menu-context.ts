import { createContext } from 'react';

/** What a `MenuItem` needs from its `Menu`: a way to close it after a selection. */
export interface MenuContextValue {
  /** Closes the menu; with `refocus`, focus returns to the trigger. */
  readonly close: (refocus: boolean) => void;
}

export const MenuContext = createContext<MenuContextValue | null>(null);
