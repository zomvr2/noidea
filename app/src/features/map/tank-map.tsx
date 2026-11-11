import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import type { Tank } from "@noidea/shared";
import type { FeatureCollection, Point } from "geojson";
import { useMemo, useState } from "react";
import { type NativeSyntheticEvent, StyleSheet } from "react-native";
import { MAP_STYLE_URL } from "@/lib/config";
import { LEVEL_COLORS, levelState } from "@/features/tanks/tank-status";

/** Centro por defecto si aún no hay estanques ubicados (Antofagasta, Chile). Cambiar según la comunidad. */
const DEFAULT_CENTER: [number, number] = [-70.4, -23.65];

interface Props {
  tanks: Tank[];
  onSelect: (tankId: number) => void;
}

/**
 * Mapa de estanques (MapLibre Native + estilo OpenFreeMap). Cada estanque es un círculo
 * coloreado por estado de nivel con una etiqueta "nombre · ≈ NN%".
 */
export function TankMap({ tanks, onSelect }: Props) {
  const located = useMemo(() => tanks.filter((t) => t.location), [tanks]);

  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: located.map((t) => {
        const state = levelState(t);
        const pct = t.level.percent === null || state === "offline" ? "?" : `≈${Math.round(t.level.percent)}%`;
        return {
          type: "Feature",
          id: t.id,
          geometry: { type: "Point", coordinates: [t.location!.longitude, t.location!.latitude] },
          properties: {
            tankId: t.id,
            color: LEVEL_COLORS[state],
            // 0-1 para el anillo de llenado; desconectado = vacío.
            fill: state === "offline" ? 0 : Math.max(0, Math.min(1, (t.level.percent ?? 0) / 100)),
            label: `${t.name}\n${pct}`,
          },
        };
      }),
    }),
    [located],
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
      padding: { top: 80, right: 60, bottom: 220, left: 60 },
    };
  });

  return (
    <MapView style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL}>
      <Camera initialViewState={initialViewState} />
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
            "circle-radius": 18,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.25,
            "circle-stroke-width": 2,
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
            "text-offset": [0, 1.8],
            "text-anchor": "top",
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#14202B", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </GeoJSONSource>
    </MapView>
  );
}
