// Registers the DOM matchers (toBeInTheDocument, ...) and the axe matcher (toHaveNoViolations)
// for every test file of a jsdom project. The matching types come from each package's
// src/vitest.d.ts, because TypeScript cannot see setup files that Vitest loads at runtime.
//
// vitest-axe is registered by hand: its `extend-expect` entry ships as an empty file and its
// types target the Vitest 0.x `Vi` namespace.
import '@testing-library/jest-dom/vitest';

import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);
