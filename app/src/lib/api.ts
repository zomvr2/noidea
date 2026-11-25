import type {
  ApiErrorBody,
  ArriveRefillRequest,
  CreateRefillRequest,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
  LocateTankRequest,
  LocateTankResponse,
  RefillListResponse,
  RefillPositionRequest,
  RefillRequest,
  RemoveTankRequest,
  RemoveTankResponse,
  Withdrawal,
} from "@noidea/shared";
import { API_URL } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Llama a la API en Vercel con el JWT de la sesión de Supabase. */
async function request<T>(path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Sin conexión con el servidor.");
  }
  const json = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? "HTTP_ERROR", json?.error?.message ?? res.statusText);
  }
  return json as T;
}

export const api = {
  locateTank: (req: LocateTankRequest) => request<LocateTankResponse>("/tanks/locate", req),
  removeTank: (req: RemoveTankRequest) => request<RemoveTankResponse>("/tanks/remove", req),
  createWithdrawal: (req: CreateWithdrawalRequest) => request<CreateWithdrawalResponse>("/withdrawals", req),
  stopWithdrawal: (id: number) => request<Withdrawal>(`/withdrawals/${id}/stop`, {}),
  // Recargas (admin/municipal). Ver docs/recargas.md.
  listRefills: () => request<RefillListResponse>("/refills"),
  requestRefill: (req: CreateRefillRequest) => request<RefillRequest>("/refills", req),
  claimRefill: (id: number) => request<RefillRequest>(`/refills/${id}/claim`, {}),
  releaseRefill: (id: number) => request<RefillRequest>(`/refills/${id}/release`, {}),
  startRefill: (id: number) => request<RefillRequest>(`/refills/${id}/start`, {}),
  sendRefillPosition: (id: number, req: RefillPositionRequest) =>
    request<RefillRequest>(`/refills/${id}/position`, req),
  arriveRefill: (id: number, req: ArriveRefillRequest) => request<RefillRequest>(`/refills/${id}/arrive`, req),
  deliverRefill: (id: number) => request<RefillRequest>(`/refills/${id}/deliver`, {}),
  cancelRefill: (id: number) => request<RefillRequest>(`/refills/${id}/cancel`, {}),
};
