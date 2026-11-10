import { type JSX, useState } from 'react';

import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ErrorScreen } from './ErrorScreen';
import { i18nFor, I18nProvider } from './i18n/i18n';
import { preferredLanguage } from './state/settings/schema';

/**
 * The error screen of the whole shell. The shell and its settings are gone by then, so the page's
 * `lang`, which the shell kept in step with the language setting, says what the player reads.
 */
function ShellErrorScreen({ onRestart }: { readonly onRestart: () => void }): JSX.Element {
  const language = preferredLanguage([
    document.documentElement.lang,
    ...window.navigator.languages,
  ]);
  return (
    <I18nProvider i18n={i18nFor(language)}>
      <ErrorScreen area="shell" onRestart={onRestart} />
    </I18nProvider>
  );
}

/**
 * The page: the shell under the root error boundary (#113), which catches what no closer boundary
 * does, in the shell itself or in any screen. Restart mounts a new boundary and a new shell, whose
 * machine starts on the menu and whose settings come back from storage; the old shell's run was
 * disposed when it unmounted.
 */
export function Root(): JSX.Element {
  const [generation, setGeneration] = useState(0);

  return (
    <ErrorBoundary
      key={generation}
      area="shell"
      fallback={
        <ShellErrorScreen
          onRestart={() => {
            setGeneration((current) => current + 1);
          }}
        />
      }
    >
      <App />
    </ErrorBoundary>
  );
}
