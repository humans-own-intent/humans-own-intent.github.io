import { describe, it, expect } from 'vitest';
import { BranchClient } from '../src/branch-client.js';

describe('BranchClient', () => {
  it('creates a child node under the branch root in the working tree', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const node = client.createNode({
      parentId: 'root-1',
      content: 'Subtopic 1',
    });

    const tree = client.getWorkingTree();
    expect(tree.nodes.get(node.id)).toEqual({
      id: node.id,
      parentId: 'root-1',
      content: 'Subtopic 1',
      orderKey: expect.any(String),
      isDeleted: false,
    });
  });

  it('orders siblings using fractional keys when inserting between existing siblings', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const first = client.createNode({
      parentId: 'root-1',
      content: 'First',
    });
    const second = client.createNode({
      parentId: 'root-1',
      content: 'Second',
    });
    const middle = client.createNode({
      parentId: 'root-1',
      content: 'Middle',
      afterNodeId: first.id,
      beforeNodeId: second.id,
    });

    expect(first.orderKey < middle.orderKey).toBe(true);
    expect(middle.orderKey < second.orderKey).toBe(true);
  });

  it('records operations in uncommitted queue with advancing Lamport clocks during local edits', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const node = client.createNode({
      parentId: 'root-1',
      content: 'Original Title',
    });
    client.updateNode(node.id, 'Updated Title');
    client.deleteNode(node.id);

    const syncReq = client.prepareSync();

    expect(syncReq.branchId).toBe('branch-1');
    expect(syncReq.baseRevision).toBe(0);
    expect(syncReq.operations).toHaveLength(3);

    expect(syncReq.operations[0]).toMatchObject({
      type: 'create_node',
      nodeId: node.id,
      lamportTime: 1,
      clientId: 'client-1',
    });
    expect(syncReq.operations[1]).toMatchObject({
      type: 'update_content',
      nodeId: node.id,
      content: 'Updated Title',
      lamportTime: 2,
      clientId: 'client-1',
    });
    expect(syncReq.operations[2]).toMatchObject({
      type: 'delete_node',
      nodeId: node.id,
      lamportTime: 3,
      clientId: 'client-1',
    });

    // Working tree marks node as deleted
    const tree = client.getWorkingTree();
    expect(tree.nodes.get(node.id)?.isDeleted).toBe(true);
  });

  it('drains accepted operations and incorporates remote operations on sync response', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const localNode = client.createNode({
      parentId: 'root-1',
      content: 'Local Node',
    });
    const syncReq = client.prepareSync();

    client.applySyncResponse({
      branchId: 'branch-1',
      headRevision: 2,
      acceptedOpIds: [syncReq.operations[0].opId],
      rejectedOps: [],
      remoteOperations: [
        {
          opId: 'remote-op-1',
          branchId: 'branch-1',
          clientId: 'client-2',
          lamportTime: 1,
          type: 'create_node',
          nodeId: 'remote-node-1',
          parentId: 'root-1',
          content: 'Remote Node',
          orderKey: 'a2',
        },
      ],
    });

    // Uncommitted queue should now be empty for next sync
    const nextSyncReq = client.prepareSync();
    expect(nextSyncReq.baseRevision).toBe(2);
    expect(nextSyncReq.operations).toHaveLength(0);

    // Working tree has both local and remote nodes
    const tree = client.getWorkingTree();
    expect(tree.nodes.get(localNode.id)?.content).toBe('Local Node');
    expect(tree.nodes.get('remote-node-1')?.content).toBe('Remote Node');
  });

  it('reparents and updates sibling position when moving a node locally', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const parentA = client.createNode({ parentId: 'root-1', content: 'Folder A' });
    const parentB = client.createNode({ parentId: 'root-1', content: 'Folder B' });
    const item1 = client.createNode({ parentId: parentA.id, content: 'Item 1' });

    // Move item1 from parentA to parentB
    client.moveNode(item1.id, parentB.id);

    const childrenA = client.getChildren(parentA.id);
    const childrenB = client.getChildren(parentB.id);

    expect(childrenA.map(n => n.id)).not.toContain(item1.id);
    expect(childrenB.map(n => n.id)).toContain(item1.id);

    const syncReq = client.prepareSync();
    const moveOp = syncReq.operations.find(o => o.type === 'move_node');
    expect(moveOp).toBeDefined();
    expect(moveOp).toMatchObject({
      type: 'move_node',
      nodeId: item1.id,
      newParentId: parentB.id,
    });
  });

  it('assigns a random [Adjective] [Noun] title when content is not specified', () => {
    const client = new BranchClient({
      clientId: 'client-1',
      branchId: 'branch-1',
      branchRootId: 'root-1',
    });

    const node = client.createNode({ parentId: 'root-1' });
    expect(node.content.split(' ')).toHaveLength(2);
    expect(node.content.length).toBeGreaterThan(3);
  });
});





