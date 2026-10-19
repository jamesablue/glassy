import { labelPriority, labelWidths, placeLabels, type PinLabel } from './label-declutter';

describe('labelWidths', () => {
  it('estimates widths from the text length', () => {
    expect(labelWidths('2–3 ft', 'Hanauma Bay')).toEqual({
      heightWidth: 6 * 7 + 16,
      nameWidth: 11 * 6.1 + 6,
    });
  });
});

describe('labelPriority', () => {
  it('orders spots from best to worst score', () => {
    expect(labelPriority([5, 9, 7], null)).toEqual([1, 2, 0]);
  });

  it('puts the selected spot first', () => {
    expect(labelPriority([5, 9, 7], 0)).toEqual([0, 1, 2]);
    expect(labelPriority(Float32Array.of(5, 9, 7), 2)).toEqual([2, 1, 0]);
  });

  it('keeps catalog order for equal scores', () => {
    expect(labelPriority([6, 6, 6], null)).toEqual([0, 1, 2]);
  });
});

describe('placeLabels', () => {
  const pin = (x: number, y: number, heightWidth = 40, nameWidth = 60): PinLabel => ({
    x,
    y,
    heightWidth,
    nameWidth,
  });

  it('gives spread-out pins their full labels', () => {
    const labels = [pin(0, 0), pin(0, 100), pin(300, 0)];
    expect(placeLabels(labels, [0, 1, 2], true)).toEqual(['full', 'full', 'full']);
  });

  it('shows heights only when names are hidden', () => {
    expect(placeLabels([pin(0, 0), pin(0, 100)], [0, 1], false)).toEqual([
      'height-only',
      'height-only',
    ]);
  });

  it('shrinks a lower-priority label to its height when the name would collide', () => {
    // The first label spans x −9…100; the second fits only without its name.
    const labels = [pin(0, 0), pin(-80, 0, 30, 50)];
    expect(placeLabels(labels, [0, 1], true)).toEqual(['full', 'height-only']);
  });

  it('shrinks a label to a dot when even its height would collide', () => {
    const labels = [pin(0, 0), pin(10, 5)];
    expect(placeLabels(labels, [0, 1], true)).toEqual(['full', 'dot']);
    expect(placeLabels(labels, [1, 0], true)).toEqual(['dot', 'full']);
  });

  it('lets a dot reserve its pin’s space', () => {
    // The second pin becomes a dot; the third label would clear the first but not that dot.
    const labels = [pin(0, 0, 40, 60), pin(50, 5), pin(30, 22, 30, 50)];
    expect(placeLabels(labels, [0, 1, 2], true)).toEqual(['full', 'dot', 'dot']);
    expect(placeLabels([labels[0] ?? pin(0, 0), labels[2] ?? pin(0, 0)], [0, 1], true)).toEqual([
      'full',
      'full',
    ]);
  });

  it('allows labels to touch without overlapping', () => {
    expect(placeLabels([pin(0, 0), pin(0, 20)], [0, 1], true)).toEqual(['full', 'full']);
    expect(placeLabels([pin(0, 0), pin(0, 19)], [0, 1], true)).toEqual(['full', 'dot']);
  });

  it('leaves spots missing from the priority list as dots and ignores unknown indices', () => {
    expect(placeLabels([pin(0, 0), pin(0, 100)], [1, 7], true)).toEqual(['dot', 'full']);
  });
});
