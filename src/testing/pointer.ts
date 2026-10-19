/**
 * Pointer helpers for jsdom, which lays nothing out and has no pointer capture: give an element a
 * horizontal box, and drive it with pointer events at chosen x positions.
 */

/** Makes `element` report a box `width` pixels wide starting `left` pixels from the viewport. */
export function setHorizontalBox(element: Element, left: number, width: number): void {
  element.getBoundingClientRect = () => new DOMRect(left, 0, width, 40);
}

/**
 * Adds the `setPointerCapture` jsdom lacks (it does nothing here) and returns how to take it away.
 */
export function stubPointerCapture(): () => void {
  const prototype = Element.prototype as Partial<Pick<Element, 'setPointerCapture'>>;
  const original = prototype.setPointerCapture;
  prototype.setPointerCapture = () => undefined;
  return () => {
    if (original) prototype.setPointerCapture = original;
    else delete prototype.setPointerCapture;
  };
}

/** Sends a pointer event of `type` at `clientX` to `element`. */
export function pointerAt(element: Element, type: string, clientX: number): void {
  element.dispatchEvent(new PointerEvent(type, { clientX, pointerId: 1, bubbles: true }));
}
