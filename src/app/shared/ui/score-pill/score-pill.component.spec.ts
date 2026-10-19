import { inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScorePillComponent } from './score-pill.component';

describe('ScorePillComponent', () => {
  const score = signal(0);

  async function render(value: number): Promise<HTMLElement> {
    score.set(value);
    const fixture = TestBed.createComponent(ScorePillComponent, {
      bindings: [inputBinding('score', score)],
    });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the score to one decimal over its rating, on the rating colour', async () => {
    const element = await render(7.44);
    expect(element.querySelector('small')?.textContent).toBe('Good');
    expect(element.textContent?.replace(/\s+/g, ' ').trim()).toBe('score 7.4 of 10, Good');
    expect(element.style.getPropertyValue('--rating-color')).toBe('#a3e635');
  });

  it.each([
    [9.9, 'Excellent'],
    [6.5, 'Good'],
    [5, 'Fair'],
    [3, 'Poor'],
    [1.2, 'Hazardous'],
  ])('rates %s as %s', async (value, label) => {
    expect((await render(value)).querySelector('small')?.textContent).toBe(label);
  });

  it('reads as a score out of 10, with the extra words for screen readers only', async () => {
    const hidden = (await render(8)).querySelectorAll('.visually-hidden');
    expect(Array.from(hidden, (span) => span.textContent?.trim())).toEqual(['score', 'of 10,']);
  });
});
