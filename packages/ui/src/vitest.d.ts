// Type side of the matchers registered at runtime by @buzzkill/config/vitest/setup-jsdom.
import '@testing-library/jest-dom/vitest';

import type { AxeMatchers } from 'vitest-axe';

declare module 'vitest' {
  // The type parameter must keep the name Vitest uses, or the interfaces will not merge.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}
