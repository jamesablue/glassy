import { Component, computed, input, output } from '@angular/core';
import { LAYER_IDS, type LayerId } from '../../domain/models';
import { IconComponent, type IconName } from '../../shared/ui';

/** A layer as the menu shows it. */
export interface LayerOption {
  readonly id: LayerId;
  readonly label: string;
  readonly icon: IconName;
}

const LAYER_NAMES: Readonly<Record<LayerId, Omit<LayerOption, 'id'>>> = {
  wind: { label: 'Wind', icon: 'wind' },
  waves: { label: 'Waves', icon: 'waves' },
  swell: { label: 'Swell', icon: 'swell' },
  period: { label: 'Swell period', icon: 'period' },
  depth: { label: 'Depth', icon: 'depth' },
};

/** Every layer, in the domain's order. */
export const LAYER_OPTIONS: readonly LayerOption[] = LAYER_IDS.map((id) => ({
  id,
  ...LAYER_NAMES[id],
}));

/**
 * The map layers to choose from: wind, waves, swell, swell period and depth. The active one is
 * pressed. Labels show beside the icons except on a phone, where they are kept for screen readers.
 */
@Component({
  selector: 'glassy-layer-picker',
  imports: [IconComponent],
  template: `
    @for (layer of layers(); track layer.id) {
      <button
        type="button"
        [class.active]="layer.active"
        [attr.aria-pressed]="layer.active"
        (click)="layerChange.emit(layer.id)"
      >
        <span class="icon"><glassy-icon [name]="layer.icon" /></span>
        <span class="label">{{ layer.label }}</span>
      </button>
    }
  `,
  styleUrl: './layer-picker.component.scss',
  host: { role: 'group', 'aria-label': 'Map layer' },
})
export class LayerPickerComponent {
  readonly active = input.required<LayerId>();
  readonly layerChange = output<LayerId>();

  protected readonly layers = computed(() =>
    LAYER_OPTIONS.map((layer) => ({ ...layer, active: layer.id === this.active() })),
  );
}
