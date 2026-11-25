import { toWithdrawal, type Withdrawal, type WithdrawalRow } from "@noidea/shared";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Sigue un retiro en vivo. El avance (RUN) y el cierre (DONE) del dispensador llegan a la tabla
 * `withdrawals` vía la API; aquí se escuchan por Realtime (lectura con RLS: solo los propios).
 * Al suscribirse se vuelve a leer la fila para no perder cambios ocurridos antes de la suscripción.
 */
export function useLiveWithdrawal(initial: Withdrawal | null): Withdrawal | null {
  const [live, setLive] = useState<Withdrawal | null>(null);
  const id = initial?.id;

  useEffect(() => {
    if (id === undefined) return;
    const apply = (row: WithdrawalRow) => setLive(toWithdrawal(row));
    const channel = supabase
      .channel(`withdrawal-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawals", filter: `id=eq.${id}` },
        ({ new: row }) => apply(row as WithdrawalRow),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void supabase
          .from("withdrawals")
          .select("*")
          .eq("id", id)
          .maybeSingle<WithdrawalRow>()
          .then(({ data }) => data && apply(data));
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id]);

  // Lo recibido por Realtime manda; mientras no llegue nada (o si es de un retiro anterior), la respuesta de la API.
  return live && live.id === id ? live : initial;
}

export function isActive(w: Withdrawal | null): boolean {
  return w?.status === "authorized" || w?.status === "dispensing";
}

/** Motivo de cierre o rechazo en palabras de la familia (los códigos vienen del dispensador o de la API). */
export function closeReasonText(reason: string | null): string | null {
  if (!reason) return null;
  if (reason.startsWith("NAK_")) {
    const nak: Record<string, string> = {
      NAK_BUSY: "El dispensador estaba ocupado con otro retiro.",
      NAK_LOW_LEVEL: "El dispensador detectó el estanque casi vacío y no abrió.",
      NAK_MAX_MS: "La cantidad supera el tiempo máximo de apertura.",
      NAK_BAD_ARGS: "El dispensador rechazó la orden.",
    };
    return nak[reason] ?? "El dispensador rechazó la orden.";
  }
  const texts: Record<string, string> = {
    TARGET: "Se entregó la cantidad pedida.",
    STOP: "Detuviste el retiro.",
    LINK_LOST: "El dispensador perdió la conexión y cerró la válvula por seguridad.",
    LOW_LEVEL: "El estanque llegó a nivel crítico y la válvula se cerró por seguridad.",
    MAX_MS: "Se alcanzó el tope de seguridad de 60 s.",
    NO_ACK: "El dispensador no respondió a tiempo. No se descontó nada.",
    SEND_FAILED: "No se pudo enviar la orden al dispensador. No se descontó nada.",
    NO_DONE: "El dispensador no informó el cierre; se descontó lo pedido.",
  };
  return texts[reason] ?? reason;
}
