import {
  ApplicationRef,
  Component,
  computed,
  createComponent,
  DestroyRef,
  effect,
  EnvironmentInjector,
  inject,
  input,
  inputBinding,
  output,
  outputBinding,
  signal,
  untracked,
  type ComponentRef,
  type WritableSignal,
} from '@angular/core';
import * as L from 'leaflet';
import {
  labelPriority,
  labelWidths,
  placeLabels,
  SHOW_NAMES_MIN_ZOOM,
  type LabelMode,
} from '../../../domain/geo';
import { PREFERS_REDUCED_MOTION } from '../../../core/reduced-motion';
import { surfText } from '../../../domain/units';
import { SettingsStore, type SpotPin } from '../../../state';
import { panelInsets } from '../../map-host/frame-oahu';
import { MapContext } from '../../map-host/map-context';
import { centreShowing, shrinkArea, visibleArea } from '../../map-host/visible-area';
import { keepLayerOnMap } from '../keep-layer-on-map';
import { SpotPinComponent } from './spot-pin.component';

/** Zooming in on a selected spot goes at least this far, where spot names show. */
const FOCUS_ZOOM = 11.5;
/** A selected spot this far out (or further) is flown to even if it is already on screen. */
const FOCUS_BELOW_ZOOM = 10.5;
/** A selected spot within this share of the visible area's edges is flown to its middle. */
const FOCUS_EDGE = 0.2;
/** Room kept around a pin brought into view by keyboard focus, CSS pixels. */
const REVEAL_PADDING = 48;
/** Lifts a highlighted pin above its neighbours, as Leaflet's `riseOnHover` does on the map. */
const HOVER_Z_OFFSET = 1000;

/** A pin on the map: its Leaflet marker and the Angular component inside it. */
interface PinMarker {
  readonly marker: L.Marker;
  readonly pin: WritableSignal<SpotPin>;
  readonly mode: WritableSignal<LabelMode>;
  readonly component: ComponentRef<SpotPinComponent>;
}

/**
 * The spot pins. Each Leaflet marker holds a real {@link SpotPinComponent}, created with
 * `createComponent` and bound to signals, so updating a pin is a signal write rather than DOM work.
 *
 * Labels are placed with the domain's collision-free `placeLabels` whenever the map settles or the
 * pins change: the selected spot and the best scores get full labels, others shrink to the surf
 * height or a dot. Selecting a spot that is off-centre or too far out flies the map to it, into the
 * middle of the part of the map the panels leave uncovered (above the sheet on a phone, beside the
 * side panel on wider screens); with reduced motion it moves there at once.
 *
 * Hovering is shared with the ranking both ways: `hoveredId` highlights a pin (its full label,
 * raised above its neighbours) and `pinHover` reports the pin under the pointer.
 */
@Component({ selector: 'glassy-spot-markers', template: '' })
export class SpotMarkersComponent {
  /** One pin per spot, in catalog order. */
  readonly pins = input.required<readonly SpotPin[]>();
  /** The spot to highlight, for example while its row in the ranking is hovered. */
  readonly hoveredId = input<string | null>(null);
  /** A pin was clicked or activated from the keyboard. Emits the spot id. */
  readonly pinSelect = output<string>();
  /** The pointer moved onto a pin (its spot id) or off it (`null`). */
  readonly pinHover = output<string | null>();

  private readonly context = inject(MapContext);
  private readonly environment = inject(EnvironmentInjector);
  private readonly appRef = inject(ApplicationRef);
  private readonly settings = inject(SettingsStore);
  private readonly reducedMotion = inject(PREFERS_REDUCED_MOTION);
  private readonly heightUnit = computed(() => this.settings.units().height);
  private readonly group = L.layerGroup();
  private readonly markers = new Map<string, PinMarker>();

  /** How much of each spot's label fits, by spot id. */
  private readonly labelModes = computed<ReadonlyMap<string, LabelMode>>(() => {
    const map = this.context.map();
    const viewport = this.context.viewport();
    const pins = this.pins();
    if (!map || !viewport) return new Map();
    const unit = this.heightUnit();
    const labels = pins.map((pin) => {
      const { x, y } = map.latLngToContainerPoint([pin.lat, pin.lon]);
      return { x, y, ...labelWidths(surfText(pin.surf, unit), pin.name) };
    });
    const selected = pins.findIndex((pin) => pin.selected);
    const priority = labelPriority(
      pins.map((pin) => pin.score),
      selected < 0 ? null : selected,
    );
    const modes = placeLabels(labels, priority, viewport.zoom >= SHOW_NAMES_MIN_ZOOM);
    return new Map(pins.map((pin, index) => [pin.id, modes[index] ?? 'dot']));
  });

  /** The selected spot, compared by id so a new hour does not count as a new selection. */
  private readonly selected = computed(() => this.pins().find((pin) => pin.selected), {
    equal: (a, b) => a?.id === b?.id,
  });

  constructor() {
    keepLayerOnMap(this.group);
    effect(() => this.update(this.pins(), this.labelModes()));
    effect(() => {
      const pin = this.selected();
      const map = this.context.map();
      if (pin && map) untracked(() => this.focus(map, pin));
    });
    effect((onCleanup) => {
      this.pins(); // The markers are made from the pins, so look again when they change.
      const marker = this.markers.get(this.hoveredId() ?? '')?.marker;
      marker?.setZIndexOffset(HOVER_Z_OFFSET);
      onCleanup(() => marker?.setZIndexOffset(0));
    });
    inject(DestroyRef).onDestroy(() => {
      this.markers.forEach(({ component }) => component.destroy());
      this.markers.clear();
    });
  }

  /** Brings the markers in line with the pins: updates, adds and removes as needed. */
  private update(pins: readonly SpotPin[], modes: ReadonlyMap<string, LabelMode>): void {
    untracked(() => {
      const ids = new Set(pins.map((pin) => pin.id));
      for (const [id, entry] of this.markers) {
        if (ids.has(id)) continue;
        entry.marker.remove();
        entry.component.destroy();
        this.markers.delete(id);
      }
      for (const pin of pins) {
        const entry = this.markers.get(pin.id) ?? this.add(pin);
        if (entry.pin().lat !== pin.lat || entry.pin().lon !== pin.lon) {
          entry.marker.setLatLng([pin.lat, pin.lon]);
        }
        entry.pin.set(pin);
        entry.mode.set(modes.get(pin.id) ?? 'dot');
      }
    });
  }

  private add(spotPin: SpotPin): PinMarker {
    const pin = signal(spotPin);
    const mode = signal<LabelMode>('dot');
    const hovered = computed(() => this.hoveredId() === pin().id);
    const component = createComponent(SpotPinComponent, {
      environmentInjector: this.environment,
      bindings: [
        inputBinding('pin', pin),
        inputBinding('mode', mode),
        inputBinding('heightUnit', this.heightUnit),
        inputBinding('hovered', hovered),
        outputBinding<string>('pinSelect', (id) => this.pinSelect.emit(id)),
        outputBinding<boolean>('pinHover', (on) => this.pinHover.emit(on ? pin().id : null)),
        outputBinding('pinFocus', () => this.reveal(pin())),
      ],
    });
    this.appRef.attachView(component.hostView);
    const marker = L.marker([spotPin.lat, spotPin.lon], {
      // A zero-size icon: the pin component positions itself around the spot.
      icon: L.divIcon({
        className: 'spot-icon',
        iconSize: [0, 0],
        html: component.location.nativeElement as HTMLElement,
      }),
      // The pin component is the focusable control, so the marker itself stays out of the tab order.
      keyboard: false,
      riseOnHover: true,
    }).addTo(this.group);
    const entry: PinMarker = { marker, pin, mode, component };
    this.markers.set(spotPin.id, entry);
    return entry;
  }

  /**
   * Flies to a selected spot unless it is already well inside the visible area at a useful zoom.
   * The spot's details open with it, so on a phone the area is what the open sheet leaves.
   */
  private focus(map: L.Map, pin: SpotPin): void {
    const size = map.getSize();
    const area = visibleArea(size, panelInsets(size.x, size.y, true));
    const target = L.latLng(pin.lat, pin.lon);
    const comfortable = shrinkArea(area, FOCUS_EDGE).contains(map.latLngToContainerPoint(target));
    if (comfortable && map.getZoom() >= FOCUS_BELOW_ZOOM) return;
    const zoom = Math.max(map.getZoom(), FOCUS_ZOOM);
    const centre = centreShowing(map, target, zoom, area.getCenter());
    if (untracked(this.reducedMotion)) map.setView(centre, zoom, { animate: false });
    else map.flyTo(centre, zoom, { duration: 0.8 });
  }

  /** Pans just enough to show a pin that keyboard focus moved to, clear of the panels. */
  private reveal(pin: SpotPin): void {
    const map = this.context.map();
    if (!map) return;
    const size = map.getSize();
    const area = visibleArea(
      size,
      panelInsets(size.x, size.y, untracked(this.selected) !== undefined),
    );
    // A short visible area (a phone held sideways, a zoomed-in page) gets less room around the pin.
    const { x, y } = area.getSize();
    const padding = Math.min(REVEAL_PADDING, x / 4, y / 4);
    const room = L.point(padding, padding);
    map.panInside([pin.lat, pin.lon], {
      paddingTopLeft: area.getTopLeft().add(room),
      paddingBottomRight: size.subtract(area.getBottomRight()).add(room),
      animate: !untracked(this.reducedMotion),
    });
  }
}
