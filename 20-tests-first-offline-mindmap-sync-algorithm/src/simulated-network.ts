import { BranchClient } from './branch-client.js';
import { BranchServer } from './branch-server.js';
import { SyncResponse } from './types.js';

export interface SyncResult {
  success: boolean;
  reason?: 'offline' | 'in_progress' | 'error';
  response?: SyncResponse;
}

export type SyncListener = (event: { clientId: string; response: SyncResponse }) => void;

export class SimulatedNetwork {
  private server: BranchServer;
  private onlineStatus: Map<string, boolean> = new Map();
  private listeners: Set<SyncListener> = new Set();
  private syncingClients: Set<string> = new Set();

  constructor(server: BranchServer) {
    this.server = server;
  }

  getServer(): BranchServer {
    return this.server;
  }

  setClientOnline(clientId: string, isOnline: boolean): void {
    this.onlineStatus.set(clientId, isOnline);
  }

  isClientOnline(clientId: string): boolean {
    return this.onlineStatus.get(clientId) ?? true;
  }

  onSync(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  syncClient(client: BranchClient, defaultRootId: string = 'root'): SyncResult {
    if (!this.isClientOnline(client.clientId)) {
      return { success: false, reason: 'offline' };
    }

    if (this.syncingClients.has(client.clientId)) {
      return { success: false, reason: 'in_progress' };
    }

    this.syncingClients.add(client.clientId);
    try {
      const request = client.prepareSync();
      const response = this.server.sync(request, defaultRootId);
      client.applySyncResponse(response);

      // Notify listeners if this sync committed new operations OR had rejected operations.
      // Pull-only syncs (acceptedOpIds and rejectedOps both empty) do not alter server state and must not trigger peer cascades.
      if (response.acceptedOpIds.length > 0 || response.rejectedOps.length > 0) {
        for (const listener of this.listeners) {
          try {
            listener({ clientId: client.clientId, response });
          } catch {
            // Ignore listener errors
          }
        }
      }

      return { success: true, response };
    } finally {
      this.syncingClients.delete(client.clientId);
    }
  }

  syncAllOnline(clients: BranchClient[], defaultRootId: string = 'root'): void {
    for (const client of clients) {
      if (this.isClientOnline(client.clientId)) {
        this.syncClient(client, defaultRootId);
      }
    }
  }
}
