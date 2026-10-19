import { inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { calmSample, testSpot } from '../../../testing/domain-builders';
import type { Conditions, HeightUnit } from '../../domain/models';
import {
  assessConditions,
  HAZARD_CURRENT_KNOTS,
  HAZARD_SURF_FEET,
  HAZARD_WIND_KNOTS,
  hazardsFor,
} from '../../domain/scoring';
import { FEET_PER_METER } from '../../domain/units';
import { HazardNoticeComponent } from './hazard-notice.component';

describe('HazardNoticeComponent', () => {
  const calm = assessConditions(testSpot(), calmSample());
  /** Conditions exactly at every warning threshold. */
  const atThresholds: Conditions = {
    ...calm,
    surf: HAZARD_SURF_FEET / FEET_PER_METER,
    effectiveWind: HAZARD_WIND_KNOTS,
    currentKnots: HAZARD_CURRENT_KNOTS,
  };
  /** Conditions just under every threshold. */
  const justUnder: Conditions = {
    ...calm,
    surf: (HAZARD_SURF_FEET - 0.01) / FEET_PER_METER,
    effectiveWind: HAZARD_WIND_KNOTS - 0.01,
    currentKnots: HAZARD_CURRENT_KNOTS - 0.01,
  };

  const conditions = signal<Conditions>(calm);
  const heightUnit = signal<HeightUnit>('ft');

  async function render(value: Conditions): Promise<HTMLElement> {
    conditions.set(value);
    const fixture = TestBed.createComponent(HazardNoticeComponent, {
      bindings: [
        inputBinding('hazards', () => hazardsFor(conditions())),
        inputBinding('conditions', conditions),
        inputBinding('heightUnit', heightUnit),
      ],
    });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const messages = (element: HTMLElement): string[] =>
    Array.from(element.querySelectorAll('.warn p'), (p) => p.textContent?.trim() ?? '');

  it('warns about big surf, strong onshore wind and strong current at their thresholds', async () => {
    const element = await render(atThresholds);
    expect(element.querySelector('.warn')?.getAttribute('role')).toBe('note');
    expect(messages(element)).toEqual([
      'Surf around 2–4 ft here. Getting in and out over the reef can be dangerous.',
      'Strong onshore wind: expect chop and poor visibility.',
      'Current near 1.0 kt offshore. Stay close to shore.',
    ]);
  });

  it('shows nothing just under the thresholds', async () => {
    const element = await render(justUnder);
    expect(element.querySelector('.warn')).toBeNull();
  });

  it('quotes the surf in the chosen unit', async () => {
    heightUnit.set('m');
    const element = await render({ ...calm, surf: 1.5 });
    expect(messages(element)).toEqual([
      'Surf around 1.2–1.8 m here. Getting in and out over the reef can be dangerous.',
    ]);
    heightUnit.set('ft');
  });
});
