// Fails when a file tracked by git is over 1 MB (#135). Every clone downloads the whole history, so
// a large file stays in it for good; generate it, compress it or keep it out of the repository.
// Runs in `pnpm lint:repo`; `docs/performance.md` gives the reasoning.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';

const LIMIT = 1_000_000;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => file !== '');

const tooLarge = [];
for (const file of files) {
  let size;
  try {
    ({ size } = statSync(file));
  } catch {
    // Deleted in the working tree but not yet in the index: nothing to measure.
    continue;
  }
  if (size > LIMIT) {
    tooLarge.push({ file, size });
  }
}

if (tooLarge.length > 0) {
  for (const { file, size } of tooLarge) {
    process.stderr.write(`${file}: ${String(size)} bytes, over the limit of ${String(LIMIT)}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    `No tracked file is over ${String(LIMIT)} bytes (${String(files.length)} checked).\n`,
  );
}
