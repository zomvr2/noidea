import type {
  ApiErrorBody,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
  LocateTankRequest,
  LocateTankResponse,
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
  createWithdrawal: (req: CreateWithdrawalRequest) => request<CreateWithdrawalResponse>("/withdrawals", req),
};
