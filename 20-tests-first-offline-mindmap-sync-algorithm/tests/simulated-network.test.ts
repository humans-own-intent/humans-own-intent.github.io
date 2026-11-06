import { describe, it, expect } from 'vitest';
import { BranchClient } from '../src/branch-client.js';
import { BranchServer } from '../src/branch-server.js';
import { SimulatedNetwork } from '../src/simulated-network.js';

describe('SimulatedNetwork', () => {
  it('blocks synchronization when client is offline and permits it when online', () => {
    const server = new BranchServer();
    const network = new SimulatedNetwork(server);

    const client = new BranchClient({
      clientId: 'client-offline-test',
      branchId: 'branch-net-1',
      branchRootId: 'root-net-1',
    });

    client.createNode({ parentId: 'root-net-1', content: 'Draft Note' });

    // Client is set to offline
    network.setClientOnline('client-offline-test', false);
    expect(network.isClientOnline('client-offline-test')).toBe(false);

    const offlineSyncResult = network.syncClient(client, 'root-net-1');
    expect(offlineSyncResult.success).toBe(false);
    expect(offlineSyncResult.reason).toBe('offline');

    // Server must NOT have received the note
    const branchBefore = server.getBranch('branch-net-1');
    expect(branchBefore).toBeNull();

    // Toggle client back online
    network.setClientOnline('client-offline-test', true);
    expect(network.isClientOnline('client-offline-test')).toBe(true);

    const onlineSyncResult = network.syncClient(client, 'root-net-1');
    expect(onlineSyncResult.success).toBe(true);
    expect(onlineSyncResult.response?.headRevision).toBe(1);

    // Server now has the note
    const branchAfter = server.getBranch('branch-net-1');
    expect(branchAfter?.revision).toBe(1);
    expect(branchAfter?.tree.nodes.get(client.getChildren('root-net-1')[0].id)?.content).toBe('Draft Note');
  });

  it('notifies listeners when a sync occurs so other online clients can converge', () => {
    const server = new BranchServer();
    const network = new SimulatedNetwork(server);

    const clientA = new BranchClient({ clientId: 'A', branchId: 'b1', branchRootId: 'r1' });
    const clientB = new BranchClient({ clientId: 'B', branchId: 'b1', branchRootId: 'r1' });

    let notifiedCount = 0;
    network.onSync(() => {
      notifiedCount++;
    });

    clientA.createNode({ parentId: 'r1', content: 'Message from A' });
    network.syncClient(clientA, 'r1');

    expect(notifiedCount).toBe(1);

    // Auto-sync client B on notification
    network.syncClient(clientB, 'r1');
    expect(clientB.getWorkingTree().nodes.size).toBe(2);
  });

  it('prevents infinite sync ping-pong loops when multiple online clients synchronize', () => {
    const server = new BranchServer();
    const network = new SimulatedNetwork(server);

    const client1 = new BranchClient({ clientId: 'c1', branchId: 'b1', branchRootId: 'r1' });
    const client2 = new BranchClient({ clientId: 'c2', branchId: 'b1', branchRootId: 'r1' });
    const client3 = new BranchClient({ clientId: 'c3', branchId: 'b1', branchRootId: 'r1' });
    const allClients = [client1, client2, client3];

    let syncCallCount = 0;

    // Simulate the exact app.ts listener logic
    network.onSync(({ clientId }) => {
      for (const c of allClients) {
        if (c.clientId !== clientId && network.isClientOnline(c.clientId)) {
          syncCallCount++;
          if (syncCallCount > 100) {
            throw new Error(`Infinite sync recursion detected! syncCallCount exceeded ${syncCallCount}`);
          }
          network.syncClient(c, 'r1');
        }
      }
    });

    client1.createNode({ parentId: 'r1', content: 'Single child creation' });
    network.syncClient(client1, 'r1');

    // Should complete cleanly with a small bounded number of syncs (e.g. c1 pushes, c2 pulls, c3 pulls)
    expect(syncCallCount).toBeLessThanOrEqual(5);
  });
});

