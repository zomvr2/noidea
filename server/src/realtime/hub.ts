import type { ServerEvent } from "@noidea/shared";
import type { WebSocket } from "ws";

/** Difunde eventos en tiempo real a todas las apps conectadas por WebSocket. */
export class RealtimeHub {
  private clients = new Set<WebSocket>();

  add(socket: WebSocket, hello: ServerEvent) {
    this.clients.add(socket);
    socket.on("close", () => this.clients.delete(socket));
    socket.on("error", () => this.clients.delete(socket));
    socket.send(JSON.stringify(hello));
  }

  broadcast(event: ServerEvent) {
    const data = JSON.stringify(event);
    for (const socket of this.clients) {
      if (socket.readyState === socket.OPEN) socket.send(data);
    }
  }

  get size() {
    return this.clients.size;
  }
}
