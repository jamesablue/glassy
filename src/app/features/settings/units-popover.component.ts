import { Component, computed, inject, viewChild } from '@angular/core';
import {
  HEIGHT_UNITS,
  SPEED_UNITS,
  TEMPERATURE_UNITS,
  type HeightUnit,
  type SpeedUnit,
  type TemperatureUnit,
} from '../../domain/models';
import { SPEED_LABELS } from '../../domain/units';
import { PopoverComponent, SegmentedControlComponent, type ChoiceOption } from '../../shared/ui';
import { SettingsStore } from '../../state';

/** The id the Units button opens this popover by. */
export const UNITS_POPOVER_ID = 'units-popover';

const TEMPERATURE_LABELS: Readonly<Record<TemperatureUnit, string>> = { f: '°F', c: '°C' };

/**
 * The display units: wave and depth heights, wind speed and temperature. A change applies
 * everywhere at once and is remembered for the next visit (`SettingsStore`).
 */
@Component({
  selector: 'glassy-units-popover',
  imports: [PopoverComponent, SegmentedControlComponent],
  template: `
    <glassy-popover heading="Units" [id]="id">
      <div class="row">
        <span id="units-height-label">Waves &amp; depth</span>
        <glassy-segmented-control
          labelledBy="units-height-label"
          [options]="heightOptions"
          [value]="units().height"
          (valueChange)="setHeight($event)"
        />
      </div>
      <div class="row">
        <span id="units-speed-label">Wind</span>
        <glassy-segmented-control
          labelledBy="units-speed-label"
          [options]="speedOptions"
          [value]="units().speed"
          (valueChange)="setSpeed($event)"
        />
      </div>
      <div class="row">
        <span id="units-temperature-label">Temperature</span>
        <glassy-segmented-control
          labelledBy="units-temperature-label"
          [options]="temperatureOptions"
          [value]="units().temperature"
          (valueChange)="setTemperature($event)"
        />
      </div>
    </glassy-popover>
  `,
  styles: `
    glassy-popover {
      --popover-top: 250px;
    }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin: 8px 0;
    }
  `,
})
export class UnitsPopoverComponent {
  private readonly settings = inject(SettingsStore);
  private readonly popover = viewChild.required(PopoverComponent);

  /** Whether the browser is showing the popover. */
  readonly isOpen = computed(() => this.popover().isOpen());

  protected readonly id = UNITS_POPOVER_ID;
  protected readonly units = this.settings.units;
  protected readonly heightOptions: readonly ChoiceOption<HeightUnit>[] = HEIGHT_UNITS.map(
    (unit) => ({ value: unit, label: unit }),
  );
  protected readonly speedOptions: readonly ChoiceOption<SpeedUnit>[] = SPEED_UNITS.map((unit) => ({
    value: unit,
    label: SPEED_LABELS[unit],
  }));
  protected readonly temperatureOptions: readonly ChoiceOption<TemperatureUnit>[] =
    TEMPERATURE_UNITS.map((unit) => ({ value: unit, label: TEMPERATURE_LABELS[unit] }));

  protected setHeight(unit: HeightUnit): void {
    this.settings.setUnit('height', unit);
  }

  protected setSpeed(unit: SpeedUnit): void {
    this.settings.setUnit('speed', unit);
  }

  protected setTemperature(unit: TemperatureUnit): void {
    this.settings.setUnit('temperature', unit);
  }
}
