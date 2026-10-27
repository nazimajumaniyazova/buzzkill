/**
 * Solid-colour stand-ins for assets that cannot be imported yet: files by other team members,
 * and files over the 1 MB repository limit. They are replaced by CC0 assets in stage 6.
 */

/**
 * Returns a data URL of a sprite sheet with `frames` squares of `width` x `height` pixels, so
 * the legacy animation code can keep slicing frames by index. Returns an empty string outside a
 * browser; an `Image` with an empty `src` simply draws nothing.
 */
export function placeholderSprite(frames: number, width: number, height: number, color: string): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = frames * width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.fillStyle = color;
  for (let frame = 0; frame < frames; frame++) {
    context.fillRect(frame * width + 2, 2, width - 4, height - 4);
  }
  return canvas.toDataURL();
}
