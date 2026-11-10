import '@buzzkill/ui/tokens.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { reportError, reportWindowErrors } from './errors/report-error';
import { Root } from './Root';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root is missing from index.html');
}

// Every unexpected error leaves through reportError (#113): the window's own, React's that no
// boundary caught, and those React recovered from. A boundary reports what it catches itself, so
// React's own console message for it would be a second copy.
reportWindowErrors();
createRoot(container, {
  onCaughtError: () => undefined,
  onUncaughtError: (error, info) => {
    reportError(error, { source: 'react', componentStack: info.componentStack });
  },
  onRecoverableError: (error, info) => {
    reportError(error, { source: 'react', componentStack: info.componentStack });
  },
}).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
