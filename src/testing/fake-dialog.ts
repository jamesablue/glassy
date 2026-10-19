/** A fake modal dialog API installed on the page. */
export interface FakeDialog {
  /** Takes the fake away again. */
  restore(): void;
}

/**
 * The parts of `<dialog>` that jsdom lacks, as `fake-popover.ts` does for popovers: `showModal()`
 * and `close()` set and clear `open` (with a `close` event), and Escape on an open dialog fires
 * `cancel` and then closes it, unless the page cancelled the event.
 */
export function installFakeDialog(): FakeDialog {
  const prototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  const saved = { showModal: prototype['showModal'], close: prototype['close'] };

  prototype['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  prototype['close'] = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (!dialog) return;
    const cancel = new Event('cancel', { cancelable: true });
    if (dialog.dispatchEvent(cancel)) dialog.close();
  };
  document.addEventListener('keydown', onKeydown, true);

  return {
    restore: () => {
      prototype['showModal'] = saved.showModal;
      prototype['close'] = saved.close;
      document.removeEventListener('keydown', onKeydown, true);
    },
  };
}
