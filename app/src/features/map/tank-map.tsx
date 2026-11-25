import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import type { Tank } from "@noidea/shared";
import type { Feature, FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { type NativeSyntheticEvent, StyleSheet } from "react-native";
import { MAP_STYLE_URL } from "@/lib/config";
import { LEVEL_COLORS, levelState } from "@/features/tanks/tank-status";
import { colors } from "@/theme";

/** Centro por defecto si aún no hay estanques ubicados (Antofagasta, Chile). Cambiar según la comunidad. */
const DEFAULT_CENTER: [number, number] = [-70.4, -23.65];

/** Municipal en camino a un estanque (posición del teléfono, cada ~10 s). */
export interface TruckMarker {
  refillId: number;
  latitude: number;
  longitude: number;
  label: string;
}

interface Props {
  tanks: Tank[];
  trucks?: TruckMarker[];
  now: number;
  selectedId: number | null;
  onSelect: (tankId: number) => void;
  /** Espacio ocupado por la UI superpuesta, para centrar bien la cámara. */
  padding: { top: number; bottom: number };
}

/**
 * Mapa de estanques (MapLibre Native + estilo OpenFreeMap). Cada estanque es un círculo
 * coloreado por estado de nivel con una etiqueta "nombre · ≈ NN%".
 */
export function TankMap({ tanks, trucks = [], now, selectedId, onSelect, padding }: Props) {
  const camera = useRef<CameraRef>(null);
  const located = useMemo(() => tanks.filter((t) => t.location), [tanks]);

  // El reloj compartido cambia `now` cada 10 s, pero casi siempre las features resultantes son
  // idénticas. Se memoriza su serialización y el GeoJSON solo se reconstruye si cambió el texto,
  // así no se reenvía la fuente al mapa nativo sin necesidad.
  const featuresKey = useMemo(
    () =>
      JSON.stringify(
        located.map((t) => {
          const state = levelState(t, now);
          const pct = t.level.percent === null || state === "offline" ? "?" : `≈${Math.round(t.level.percent)}%`;
          return {
            type: "Feature",
            id: t.id,
            geometry: { type: "Point", coordinates: [t.location!.longitude, t.location!.latitude] },
            properties: {
              tankId: t.id,
              // Lo leen las capas para agrandar el halo del estanque elegido.
              selected: t.id === selectedId ? 1 : 0,
              color: LEVEL_COLORS[state],
              // 0-1 para el anillo de llenado; desconectado = vacío.
              fill: state === "offline" ? 0 : Math.max(0, Math.min(1, (t.level.percent ?? 0) / 100)),
              label: `${t.name}\n${pct}`,
            },
          } satisfies Feature<Point>;
        }),
      ),
    [located, now, selectedId],
  );
  const data = useMemo<FeatureCollection<Point>>(
    () => ({ type: "FeatureCollection", features: JSON.parse(featuresKey) as Feature<Point>[] }),
    [featuresKey],
  );

  const truckData = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: trucks.map((t) => ({
        type: "Feature",
        id: t.refillId,
        geometry: { type: "Point", coordinates: [t.longitude, t.latitude] },
        properties: { label: t.label },
      })),
    }),
    [trucks],
  );

  // Vista inicial calculada una sola vez (el padre monta el mapa cuando ya cargaron los estanques).
  const [initialViewState] = useState(() => {
    if (located.length === 0) return { center: DEFAULT_CENTER, zoom: 11 };
    if (located.length === 1) {
      const l = located[0]!.location!;
      return { center: [l.longitude, l.latitude] as [number, number], zoom: 15 };
    }
    const lngs = located.map((t) => t.location!.longitude);
    const lats = located.map((t) => t.location!.latitude);
    return {
      bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] as [
        number,
        number,
        number,
        number,
      ],
      padding: { top: padding.top + 40, right: 60, bottom: padding.bottom + 40, left: 60 },
    };
  });

  // Al seleccionar un estanque (desde el mapa o la fila inferior), centrarlo con animación.
  useEffect(() => {
    const loc = located.find((t) => t.id === selectedId)?.location;
    if (!loc) return;
    camera.current?.easeTo({
      center: [loc.longitude, loc.latitude],
      duration: 450,
      padding: { top: padding.top, bottom: padding.bottom, left: 0, right: 0 },
    });
    // Solo al cambiar la selección; no seguir cada actualización de nivel.
  }, [selectedId]);

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      mapStyle={MAP_STYLE_URL}
      logo={false}
      compassPosition={{ top: padding.top + 8, right: 16 }}
      attributionPosition={{ bottom: padding.bottom + 8, left: 8 }}
      tintColor={colors.primary}
    >
      <Camera ref={camera} initialViewState={initialViewState} />
      <GeoJSONSource
        id="tanks"
        data={data}
        onPress={(e: NativeSyntheticEvent<PressEventWithFeatures>) => {
          const id = e.nativeEvent.features[0]?.properties?.tankId;
          if (typeof id === "number") onSelect(id);
        }}
      >
        {/* Halo exterior: color del estado */}
        <Layer
          type="circle"
          id="tanks-halo"
          source="tanks"
          paint={{
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 24, 18],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.22,
            "circle-stroke-width": ["case", ["==", ["get", "selected"], 1], 3, 2],
            "circle-stroke-color": ["get", "color"],
          }}
        />
        {/* Núcleo: su tamaño representa el nivel estimado */}
        <Layer
          type="circle"
          id="tanks-level"
          source="tanks"
          paint={{
            "circle-radius": ["+", 4, ["*", 12, ["get", "fill"]]],
            "circle-color": ["get", "color"],
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          }}
        />
        <Layer
          type="symbol"
          id="tanks-label"
          source="tanks"
          layout={{
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"], // fuente disponible en el estilo liberty de OpenFreeMap
            "text-size": 12,
            "text-offset": [0, 2.1],
            "text-anchor": "top",
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": colors.text, "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </GeoJSONSource>
      {/* Camión del municipal en camino: punto con borde blanco y su ETA. */}
      <GeoJSONSource id="trucks" data={truckData}>
        <Layer
          type="circle"
          id="trucks-halo"
          source="trucks"
          paint={{ "circle-radius": 14, "circle-color": colors.primary, "circle-opacity": 0.18 }}
        />
        <Layer
          type="circle"
          id="trucks-dot"
          source="trucks"
          paint={{
            "circle-radius": 7,
            "circle-color": colors.primary,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          }}
        />
        <Layer
          type="symbol"
          id="trucks-label"
          source="trucks"
          layout={{
            "text-field": ["get", "label"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 11,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": colors.primary, "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </GeoJSONSource>
    </MapView>
  );
}
