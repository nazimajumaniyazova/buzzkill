import { Button, Dialog, Inline, Stack, TextField } from '@buzzkill/ui';
import { type JSX, type SyntheticEvent, useRef, useState } from 'react';

import { checkNickname, type NicknameProblem, type NicknameSaved } from './backend/nickname';
import { reportError } from './errors/report-error';
import { useI18n } from './i18n/i18n';

type SaveFailure = Extract<NicknameSaved, { readonly ok: false }>['problem'];

interface NicknameDialogProps {
  /** The nickname the player has, or `null` before they pick one. */
  readonly nickname: string | null;
  /** Sends a nickname the client accepts; the database checks it again (#217). */
  readonly onSave: (nickname: string) => Promise<NicknameSaved>;
  /** Called on Cancel, Escape and the close button, and once the nickname is saved. */
  readonly onClose: () => void;
}

/**
 * Where the player picks the nickname the boards show (#217). The field says its rules, and what
 * is wrong with a nickname before anything is sent, with focus back on it. A failure to save is
 * said in an alert, and the player can try again. A nickname is only ever text here: the value of
 * the field.
 */
export function NicknameDialog({ nickname, onSave, onClose }: NicknameDialogProps): JSX.Element {
  const { t } = useI18n();
  const [typed, setTyped] = useState(nickname ?? '');
  const [problem, setProblem] = useState<NicknameProblem | null>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [saving, setSaving] = useState(false);
  // A second press before the state of the first has rendered sends nothing either.
  const savingRef = useRef(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  const finish = (saved: NicknameSaved): void => {
    savingRef.current = false;
    setSaving(false);
    if (saved.ok) {
      onClose();
    } else {
      setFailure(saved.problem);
    }
  };

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (savingRef.current) {
      return;
    }
    const checked = checkNickname(typed);
    if (!checked.ok) {
      setProblem(checked.problem);
      fieldRef.current?.focus();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFailure(null);
    onSave(checked.nickname).then(finish, (error: unknown) => {
      // `onSave` answers with a result; a throw is a bug, and the player sees a failure.
      reportError(error, { source: 'shell' });
      finish({ ok: false, problem: 'unavailable' });
    });
  };

  return (
    <Dialog
      open
      title={t.nickname.title}
      description={t.nickname.description}
      closeLabel={t.common.close}
      onClose={onClose}
    >
      <form noValidate onSubmit={submit}>
        <Stack gap="lg">
          <TextField
            ref={fieldRef}
            label={t.nickname.label}
            description={t.nickname.rules}
            {...(problem === null ? {} : { error: t.nickname.problems[problem] })}
            value={typed}
            onValueChange={(value) => {
              setTyped(value);
              setProblem(null);
            }}
            autoComplete="nickname"
            autoCapitalize="off"
            spellCheck={false}
          />
          {failure === null ? null : <p role="alert">{t.nickname.failures[failure]}</p>}
          <Inline gap="lg" justify="center">
            <Button type="submit">{saving ? t.nickname.saving : t.nickname.save}</Button>
            <Button variant="secondary" onClick={onClose}>
              {t.nickname.cancel}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Dialog>
  );
}
