/** What the app-wide keys do. */
export type Shortcut = 'previous-hour' | 'next-hour' | 'toggle-play' | 'close';

/** Where typing goes, so no key there is a shortcut. */
const TEXT_ENTRY = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** Controls that Space activates, so Space there is not a shortcut. */
const SPACE_CONTROLS = [
  'button',
  'a[href]',
  'summary',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
].join(', ');

/**
 * The app-wide shortcut a key press asks for, or `null`:
 *
 * - ← and → step the timeline an hour
 * - Space plays or pauses it
 * - Escape closes what is open
 *
 * Keys are left alone when another part of the page has handled them (`defaultPrevented`, as the
 * timeline slider and radio groups do with the arrows), when a modifier is held (so browser
 * shortcuts such as Alt+← still work), while typing, and for Space on a control it activates.
 */
export function shortcutFor(event: KeyboardEvent): Shortcut | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TEXT_ENTRY)) return null;
  switch (event.key) {
    case 'ArrowLeft':
      return 'previous-hour';
    case 'ArrowRight':
      return 'next-hour';
    case ' ':
      return target?.closest(SPACE_CONTROLS) ? null : 'toggle-play';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}
