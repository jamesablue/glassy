import type { SpotHourSample, WaveComponent } from './sample';

export type WaveComponentKind = 'primarySwell' | 'secondarySwell' | 'windWaves';

/** Wind direction relative to the shoreline. */
export type WindKind = 'onshore' | 'cross-shore' | 'offshore';

interface WaveComponentBase extends WaveComponent {
  readonly kind: WaveComponentKind;
}

/** A wave component the model has no height or direction for. It adds no surf. */
export interface MissingWaveComponent extends WaveComponentBase {
  readonly available: false;
}

/** A wave component and how much of it reaches the spot. */
export interface ExposedWaveComponent extends WaveComponentBase {
  readonly available: true;
  /** Fraction (0–1) of the component that reaches the spot, given where it comes from. */
  readonly exposure: number;
  /** Breaking height this component adds at the spot before shelter, metres. */
  readonly surf: number;
}

export type AssessedWaveComponent = MissingWaveComponent | ExposedWaveComponent;

/** Snorkel conditions at one spot for one hour: the result of `assessConditions`. */
export interface Conditions {
  /** Snorkel score from 0 (stay out) to 10 (glassy). */
  readonly score: number;
  /** Estimated breaking surf height at the spot, metres. */
  readonly surf: number;
  readonly components: readonly [
    AssessedWaveComponent,
    AssessedWaveComponent,
    AssessedWaveComponent,
  ];
  /** Angle between the wind and the shoreline's facing: 0 = straight onshore, 180 = offshore. */
  readonly relativeWindAngle: number;
  readonly windKind: WindKind;
  /** Wind speed weighted by how onshore it is and reduced by shelter, knots. */
  readonly effectiveWind: number;
  /** Surface current speed, knots (0 when the model has no data). */
  readonly currentKnots: number;
  /** The forecast values these conditions were worked out from. */
  readonly sample: SpotHourSample;
}
