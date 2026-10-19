import { shortcutFor } from './keyboard-shortcuts';

describe('shortcutFor', () => {
  /** A key pressed with focus on `target` (the page itself when omitted). */
  function keydown(key: string, target?: Element, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    Object.defineProperty(event, 'target', { value: target ?? document.body });
    return event;
  }

  function element(html: string): Element {
    const template = document.createElement('template');
    template.innerHTML = html;
    const node = template.content.firstElementChild;
    if (!node) throw new Error('No element');
    return node;
  }

  it.each([
    ['ArrowLeft', 'previous-hour'],
    ['ArrowRight', 'next-hour'],
    [' ', 'toggle-play'],
    ['Escape', 'close'],
  ])('maps %j to %s', (key, shortcut) => {
    expect(shortcutFor(keydown(key))).toBe(shortcut);
  });

  it('ignores other keys', () => {
    expect(shortcutFor(keydown('Enter'))).toBeNull();
    expect(shortcutFor(keydown('ArrowUp'))).toBeNull();
  });

  it('leaves keys another control has handled', () => {
    const event = keydown('ArrowRight');
    event.preventDefault();
    expect(shortcutFor(event)).toBeNull();
  });

  it('leaves browser shortcuts alone', () => {
    expect(shortcutFor(keydown('ArrowLeft', undefined, { altKey: true }))).toBeNull();
    expect(shortcutFor(keydown('ArrowRight', undefined, { metaKey: true }))).toBeNull();
    expect(shortcutFor(keydown(' ', undefined, { ctrlKey: true }))).toBeNull();
  });

  it.each([
    '<input />',
    '<textarea></textarea>',
    '<select></select>',
    '<div contenteditable="true"></div>',
  ])('ignores every key while typing in %s', (html) => {
    expect(shortcutFor(keydown('ArrowLeft', element(html)))).toBeNull();
    expect(shortcutFor(keydown('Escape', element(html)))).toBeNull();
  });

  it.each([
    '<button></button>',
    '<a href="/"></a>',
    '<div role="radio"></div>',
    '<div role="slider"></div>',
  ])('leaves Space to %s, which it activates', (html) => {
    expect(shortcutFor(keydown(' ', element(html)))).toBeNull();
    expect(shortcutFor(keydown('ArrowRight', element(html)))).toBe('next-hour');
  });

  it('plays with Space from the map', () => {
    expect(shortcutFor(keydown(' ', element('<div tabindex="0" class="map"></div>')))).toBe(
      'toggle-play',
    );
  });
});
