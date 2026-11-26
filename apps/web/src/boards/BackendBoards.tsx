import { type JSX, useState } from 'react';

import { type BoardsSource, boardsSourceOf } from '../backend/boards';
import type { Backend } from '../backend/client';
import { BoardsScreen, type BoardsScreenProps } from './BoardsScreen';

/** The boards of a build without a backend: never reached from the menu, and offline if they are. */
const NO_BACKEND: BoardsSource = {
  board: () => Promise.reject(new Error('this build has no backend')),
  personalBest: () => Promise.reject(new Error('this build has no backend')),
  profile: () => Promise.reject(new Error('this build has no backend')),
  saveNickname: () => Promise.resolve({ ok: false, problem: 'offline' }),
};

interface BackendBoardsProps extends Omit<BoardsScreenProps, 'source' | 'queryClient'> {
  readonly backend: Pick<Backend, 'client' | 'player'> | null;
}

/**
 * The boards screen on the backend of the build (#220): the entry of the boards' chunk, which the
 * shell imports on demand, so that reading the boards and TanStack Query stay out of the main
 * chunk.
 */
export function BackendBoards({ backend, ...props }: BackendBoardsProps): JSX.Element {
  const [source] = useState(() => (backend === null ? NO_BACKEND : boardsSourceOf(backend)));
  return <BoardsScreen source={source} {...props} />;
}
