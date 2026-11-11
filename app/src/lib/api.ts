import type { DeviceStatus, Tank } from "@noidea/shared";
import { SERVER_URL } from "./config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "NETWORK", `No se pudo conectar con el servidor (${SERVER_URL})`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? "HTTP_ERROR", body?.error?.message ?? res.statusText);
  }
  return body as T;
}

export interface Health {
  ok: boolean;
  serverTime: string;
  hardwareMode: "serial" | "simulator";
  device: DeviceStatus;
}

export const api = {
  health: () => request<Health>("/api/health"),
  tanks: () => request<Tank[]>("/api/tanks"),
  tank: (id: number) => request<Tank>(`/api/tanks/${id}`),
};
