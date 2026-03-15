import type { RadioEvent } from './types';

type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
  connectedAt: number;
};

class SSEManager {
  private clients: Map<string, SSEClient> = new Map();
  private clientCounter = 0;

  addClient(controller: ReadableStreamDefaultController): string {
    const id = `client-${++this.clientCounter}-${Date.now()}`;
    this.clients.set(id, { id, controller, connectedAt: Date.now() });
    console.log(`[zo-radio-sse] Client connected: ${id} (total: ${this.clients.size})`);
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
    console.log(`[zo-radio-sse] Client disconnected: ${id} (total: ${this.clients.size})`);
  }

  broadcast(event: RadioEvent): void {
    const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    const deadClients: string[] = [];

    for (const [id, client] of this.clients) {
      try {
        client.controller.enqueue(new TextEncoder().encode(data));
      } catch {
        deadClients.push(id);
      }
    }

    for (const id of deadClients) {
      this.clients.delete(id);
    }

    if (this.clients.size > 0) {
      console.log(`[zo-radio-sse] Broadcast ${event.type} to ${this.clients.size} clients`);
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

// Module-level singleton — survives across requests in persistent Railway process
let _manager: SSEManager | null = null;

export function getSSEManager(): SSEManager {
  if (!_manager) {
    _manager = new SSEManager();
  }
  return _manager;
}
