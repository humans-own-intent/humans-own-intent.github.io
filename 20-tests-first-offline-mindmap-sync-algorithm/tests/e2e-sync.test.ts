import { describe, it, expect } from 'vitest';
import { BranchClient } from '../src/branch-client.js';
import { BranchServer } from '../src/branch-server.js';

describe('Collaborative Offline Sync (End-to-End Seam)', () => {
  it('converges two offline clients to an identical tree after bidirectional sync', () => {
    const server = new BranchServer();
    const branchId = 'mindmap-branch-finance';
    const rootId = 'finance-root';

    // 1. Client A initializes branch and creates initial hierarchy
    const clientA = new BranchClient({
      clientId: 'client-A',
      branchId,
      branchRootId: rootId,
    });

    const topic1 = clientA.createNode({
      parentId: rootId,
      content: 'Quarterly Budget',
    });
    const subtopicA = clientA.createNode({
      parentId: topic1.id,
      content: 'Q1 Projections',
    });

    // Client A syncs to server
    const syncResA1 = server.sync(clientA.prepareSync(), rootId);
    clientA.applySyncResponse(syncResA1);

    // 2. Client B connects for the first time and syncs
    const clientB = new BranchClient({
      clientId: 'client-B',
      branchId,
      branchRootId: rootId,
    });
    const syncResB1 = server.sync(clientB.prepareSync(), rootId);
    clientB.applySyncResponse(syncResB1);

    // Verify Client B has the initial tree
    expect(clientB.getWorkingTree().nodes.get(topic1.id)?.content).toBe('Quarterly Budget');
    expect(clientB.getWorkingTree().nodes.get(subtopicA.id)?.content).toBe('Q1 Projections');

    // 3. BOTH clients go offline and perform concurrent modifications
    // Client A offline:
    clientA.updateNode(topic1.id, 'Quarterly Budget (Edited by A)');
    const subtopicB = clientA.createNode({
      parentId: topic1.id,
      content: 'Q2 Projections',
    });

    // Client B offline: makes 2 edits so its Lamport clock advances higher
    clientB.updateNode(topic1.id, 'Intermediate note');
    clientB.updateNode(topic1.id, 'Quarterly Budget (Finalized by B)');
    const subtopicC = clientB.createNode({
      parentId: topic1.id,
      content: 'Q3 Projections',
    });

    // 4. Client A reconnects first and syncs
    const syncResA2 = server.sync(clientA.prepareSync(), rootId);
    clientA.applySyncResponse(syncResA2);

    // 5. Client B reconnects and syncs (pushes its changes, pulls Client A's new subtopicB)
    const syncResB2 = server.sync(clientB.prepareSync(), rootId);
    clientB.applySyncResponse(syncResB2);

    // 6. Client A syncs again to pull Client B's changes
    const syncResA3 = server.sync(clientA.prepareSync(), rootId);
    clientA.applySyncResponse(syncResA3);

    // 7. Verify eventual consistency and convergence
    const treeA = clientA.getWorkingTree();
    const treeB = clientB.getWorkingTree();

    // The winning content on topic1 must be B's (higher Lamport time)
    expect(treeA.nodes.get(topic1.id)?.content).toBe('Quarterly Budget (Finalized by B)');
    expect(treeB.nodes.get(topic1.id)?.content).toBe('Quarterly Budget (Finalized by B)');

    // Both subtopics created offline must exist in both clients
    expect(treeA.nodes.get(subtopicB.id)?.content).toBe('Q2 Projections');
    expect(treeB.nodes.get(subtopicB.id)?.content).toBe('Q2 Projections');

    expect(treeA.nodes.get(subtopicC.id)?.content).toBe('Q3 Projections');
    expect(treeB.nodes.get(subtopicC.id)?.content).toBe('Q3 Projections');

    // Both clients must have the exact same list of non-deleted children under topic1 in identical order
    const childrenA = clientA.getChildren(topic1.id).map(n => n.id);
    const childrenB = clientB.getChildren(topic1.id).map(n => n.id);
    expect(childrenA).toEqual(childrenB);
  });

  it('guarantees tombstone persistence when one client deletes while another edits offline', () => {
    const server = new BranchServer();
    const branchId = 'mindmap-branch-tombstone';
    const rootId = 'tombstone-root';

    const clientA = new BranchClient({ clientId: 'client-A', branchId, branchRootId: rootId });
    const target = clientA.createNode({ parentId: rootId, content: 'To Be Deleted' });

    // Initial sync
    server.sync(clientA.prepareSync(), rootId);

    const clientB = new BranchClient({ clientId: 'client-B', branchId, branchRootId: rootId });
    clientB.applySyncResponse(server.sync(clientB.prepareSync(), rootId));

    // Client A deletes offline
    clientA.deleteNode(target.id);

    // Client B edits offline
    clientB.updateNode(target.id, 'Edit on doomed node');

    // Sync both
    clientA.applySyncResponse(server.sync(clientA.prepareSync(), rootId));
    clientB.applySyncResponse(server.sync(clientB.prepareSync(), rootId));
    clientA.applySyncResponse(server.sync(clientA.prepareSync(), rootId));

    // Both should agree the node is deleted
    expect(clientA.getWorkingTree().nodes.get(target.id)?.isDeleted).toBe(true);
    expect(clientB.getWorkingTree().nodes.get(target.id)?.isDeleted).toBe(true);
    expect(clientA.getChildren(rootId).map(n => n.id)).not.toContain(target.id);
    expect(clientB.getChildren(rootId).map(n => n.id)).not.toContain(target.id);
  });

  it('safely handles concurrent move races between offline clients avoiding cyclic partition', () => {
    const server = new BranchServer();
    const branchId = 'mindmap-branch-cycle-race';
    const rootId = 'cycle-root';

    // 1. Initial tree: Root -> Node 1 -> Node 2
    const clientA = new BranchClient({ clientId: 'client-A', branchId, branchRootId: rootId });
    const node1 = clientA.createNode({ parentId: rootId, content: 'Node 1' });
    const node2 = clientA.createNode({ parentId: node1.id, content: 'Node 2' });

    server.sync(clientA.prepareSync(), rootId);

    const clientB = new BranchClient({ clientId: 'client-B', branchId, branchRootId: rootId });
    clientB.applySyncResponse(server.sync(clientB.prepareSync(), rootId));

    // 2. Both go offline and make conflicting moves:
    // Client A moves Node 1 to be a child of Node 2
    // (First moving Node 2 to Root, then Node 1 under Node 2)
    clientA.moveNode(node2.id, rootId);
    clientA.moveNode(node1.id, node2.id);

    // Client B moves Node 2 under Node 1
    clientB.moveNode(node2.id, node1.id);

    // 3. Client A syncs first
    const resA = server.sync(clientA.prepareSync(), rootId);
    clientA.applySyncResponse(resA);
    expect(resA.rejectedOps).toHaveLength(0);

    // 4. Client B syncs second
    const resB = server.sync(clientB.prepareSync(), rootId);
    clientB.applySyncResponse(resB);

    // Client B's move was rejected because it would create a cycle on server state
    expect(resB.rejectedOps).toContainEqual(
      expect.objectContaining({ reason: 'cycle_detected' })
    );

    // 5. Client A pulls latest from server
    clientA.applySyncResponse(server.sync(clientA.prepareSync(), rootId));

    // 6. Both clients agree on the acyclic structure: Node 2 is under Root, Node 1 is under Node 2
    const treeA = clientA.getWorkingTree();
    const treeB = clientB.getWorkingTree();

    expect(treeA.nodes.get(node2.id)?.parentId).toBe(rootId);
    expect(treeB.nodes.get(node2.id)?.parentId).toBe(rootId);

    expect(treeA.nodes.get(node1.id)?.parentId).toBe(node2.id);
    expect(treeB.nodes.get(node1.id)?.parentId).toBe(node2.id);
  });

  it('reverts rejected cycle-inducing move on the losing client when two siblings X and Y are moved under each other', () => {
    const server = new BranchServer();
    const branchId = 'mindmap-branch-sibling-cycle';
    const rootId = 'sibling-root';

    // 1. Initial tree: Root has two children X and Y
    const clientA = new BranchClient({ clientId: 'client-A', branchId, branchRootId: rootId });
    const nodeX = clientA.createNode({ parentId: rootId, content: 'Node X' });
    const nodeY = clientA.createNode({ parentId: rootId, content: 'Node Y' });

    clientA.applySyncResponse(server.sync(clientA.prepareSync(), rootId));

    const clientB = new BranchClient({ clientId: 'client-B', branchId, branchRootId: rootId });
    clientB.applySyncResponse(server.sync(clientB.prepareSync(), rootId));

    // 2. Both go offline:
    // Client A moves X under Y
    clientA.moveNode(nodeX.id, nodeY.id);
    // Client B moves Y under X
    clientB.moveNode(nodeY.id, nodeX.id);

    // 3. Client A reconnects and syncs first (X under Y wins on server)
    clientA.applySyncResponse(server.sync(clientA.prepareSync(), rootId));

    // 4. Client B reconnects and syncs second (Y under X is rejected as cycle)
    const resB = server.sync(clientB.prepareSync(), rootId);
    expect(resB.rejectedOps).toEqual([
      expect.objectContaining({ reason: 'cycle_detected' }),
    ]);
    clientB.applySyncResponse(resB);

    // 5. Client B must NOT keep the rejected op in its uncommitted queue
    expect(clientB.prepareSync().operations).toHaveLength(0);

    // 6. Client B must have reverted Y's parentId back to rootId (not X!), so both clients show Root -> Y -> X
    const treeA = clientA.getWorkingTree();
    const treeB = clientB.getWorkingTree();

    expect(treeA.nodes.get(nodeY.id)?.parentId).toBe(rootId);
    expect(treeB.nodes.get(nodeY.id)?.parentId).toBe(rootId);

    expect(treeA.nodes.get(nodeX.id)?.parentId).toBe(nodeY.id);
    expect(treeB.nodes.get(nodeX.id)?.parentId).toBe(nodeY.id);

    expect(clientB.getChildren(rootId).map(n => n.id)).toEqual([nodeY.id]);
    expect(clientB.getChildren(nodeY.id).map(n => n.id)).toEqual([nodeX.id]);
  });
});



