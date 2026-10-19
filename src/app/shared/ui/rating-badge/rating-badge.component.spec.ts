import { inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Rating } from '../../../domain/models';
import { RATINGS } from '../../../domain/scoring';
import { RatingBadgeComponent } from './rating-badge.component';

describe('RatingBadgeComponent', () => {
  it.each(RATINGS.map((rating) => [rating.label, rating] as const))(
    'shows %s on its colour',
    async (label, rating) => {
      const fixture = TestBed.createComponent(RatingBadgeComponent, {
        bindings: [inputBinding('rating', signal<Rating>(rating))],
      });
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.textContent).toBe(label);
      expect(element.style.getPropertyValue('--rating-color')).toBe(rating.color);
    },
  );
});
