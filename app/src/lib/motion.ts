import { useEffect, useRef } from "react";
import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

/**
 * Sistema de movimiento de NoIdea. Reglas:
 * - Todo corre en el hilo de UI (Reanimated): nada de `Animated` de RN ni estado por fotograma.
 * - Movimiento corto y con propósito: confirmar un toque, mostrar que llegó un dato nuevo,
 *   orientar al entrar a una pantalla. Nada se anima en bucle salvo el indicador «en vivo».
 * - Respeta «Reducir movimiento» del sistema (Reanimated usa `ReduceMotion.System` por defecto).
 */

export const duration = { fast: 140, base: 220, slow: 360 } as const;

const easeOut = Easing.out(Easing.cubic);

export const springs = {
  /** Respuesta al soltar un toque: rápida, con un leve rebote. */
  press: { damping: 14, stiffness: 340, mass: 0.6 },
  /** Cambios de layout y tarjetas que aparecen. */
  gentle: { damping: 18, stiffness: 200, mass: 1 },
} as const;

/** Retraso escalonado para listas; tope para que los últimos no esperen demasiado. */
export function stagger(index: number, step = 45, max = 8): number {
  return Math.min(index, max) * step;
}

/** Entrada estándar: sube 12 px y aparece. */
export function enterUp(index = 0) {
  return FadeInDown.duration(duration.slow)
    .delay(stagger(index))
    .easing(easeOut)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] });
}

/** Entrada de tarjeta flotante (con resorte). */
export const enterCard = FadeInDown.springify()
  .damping(springs.gentle.damping)
  .stiffness(springs.gentle.stiffness)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 24 }] });

export const fadeIn = FadeIn.duration(duration.base);
export const fadeOut = FadeOut.duration(duration.fast);

/** Transición de layout para elementos que cambian de tamaño o posición. */
export const layoutSpring = LinearTransition.springify().damping(springs.gentle.damping).stiffness(240);

/**
 * Escala al presionar. Devuelve handlers para `onPressIn`/`onPressOut`, el valor `pressed` (0-1)
 * para interpolar colores y un estilo animado con la escala.
 */
export function usePressScale(scaleTo = 0.97) {
  const pressed = useSharedValue(0);
  const onPressIn = () => {
    pressed.set(withTiming(1, { duration: 90 }));
  };
  const onPressOut = () => {
    pressed.set(withSpring(0, springs.press));
  };
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - scaleTo) * pressed.value }],
  }));
  return { pressed, onPressIn, onPressOut, scaleStyle };
}

/**
 * «Latido» breve cuando cambia un valor en vivo (nivel, cuota): atenúa y vuelve.
 * No se dispara en el primer render, solo cuando llega un dato distinto.
 */
export function useUpdatePulse(value: unknown) {
  const flash = useSharedValue(0);
  const previous = useRef(value);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    flash.set(withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 420, easing: easeOut })));
  }, [value, flash]);

  return useAnimatedStyle(() => ({
    opacity: 1 - flash.value * 0.55,
    transform: [{ scale: 1 + flash.value * 0.04 }],
  }));
}
