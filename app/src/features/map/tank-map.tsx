import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map as MapView,
  type PressEventWithFeatures,
} from "@maplibre/maplibre-react-native";
import type { Tank } from "@noidea/shared";
import type { FeatureCollection, Point } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import { type NativeSyntheticEvent, StyleSheet } from "react-native";
import { MAP_STYLE_URL } from "@/lib/config";
import { LEVEL_COLORS, levelState } from "@/features/tanks/tank-status";
import { colors } from "@/theme";

/** Centro por defecto si aún no hay estanques ubicados (Antofagasta, Chile). Cambiar según la comunidad. */
const DEFAULT_CENTER: [number, number] = [-70.4, -23.65];

interface Props {
  tanks: Tank[];
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
export function TankMap({ tanks, now, selectedId, onSelect, padding }: Props) {
  const camera = useRef<CameraRef>(null);
  const located = useMemo(() => tanks.filter((t) => t.location), [tanks]);

  const data = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: located.map((t) => {
        const state = levelState(t, now);
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
    [located, now, selectedId],
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
    </MapView>
  );
}
