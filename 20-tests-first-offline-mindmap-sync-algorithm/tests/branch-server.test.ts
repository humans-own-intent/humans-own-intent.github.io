import { describe, it, expect } from 'vitest';
import { BranchServer } from '../src/branch-server.js';
import { SyncRequest } from '../src/types.js';

describe('BranchServer', () => {
  it('initializes branch on first sync and accepts valid client operations', () => {
    const server = new BranchServer();
    const req: SyncRequest = {
      branchId: 'branch-1',
      clientId: 'client-1',
      baseRevision: 0,
      operations: [
        {
          opId: 'op-1',
          branchId: 'branch-1',
          clientId: 'client-1',
          lamportTime: 1,
          type: 'create_node',
          nodeId: 'node-1',
          parentId: 'root-1',
          content: 'Alpha',
          orderKey: 'a0',
        },
      ],
    };

    const response = server.sync(req, 'root-1');

    expect(response.branchId).toBe('branch-1');
    expect(response.headRevision).toBe(1);
    expect(response.acceptedOpIds).toEqual(['op-1']);
    expect(response.rejectedOps).toEqual([]);
    expect(response.remoteOperations).toEqual([]);

    const branch = server.getBranch('branch-1');
    expect(branch?.revision).toBe(1);
    expect(branch?.tree.nodes.get('node-1')?.content).toBe('Alpha');
  });

  it('resolves concurrent updates using Last-Write-Wins and prevents resurrection of tombstoned nodes', () => {
    const server = new BranchServer();

    // Initial creation of node-1
    server.sync(
      {
        branchId: 'branch-1',
        clientId: 'client-1',
        baseRevision: 0,
        operations: [
          {
            opId: 'init-1',
            branchId: 'branch-1',
            clientId: 'client-1',
            lamportTime: 1,
            type: 'create_node',
            nodeId: 'node-1',
            parentId: 'root-1',
            content: 'Initial',
            orderKey: 'a0',
          },
        ],
      },
      'root-1'
    );

    // Client-2 made an edit at lamportTime: 5
    server.sync({
      branchId: 'branch-1',
      clientId: 'client-2',
      baseRevision: 1,
      operations: [
        {
          opId: 'c2-edit',
          branchId: 'branch-1',
          clientId: 'client-2',
          lamportTime: 5,
          type: 'update_content',
          nodeId: 'node-1',
          content: 'Winning Edit from Client 2',
        },
      ],
    });

    // Client-1 syncs an offline edit made at lamportTime: 2 (older clock)
    server.sync({
      branchId: 'branch-1',
      clientId: 'client-1',
      baseRevision: 1,
      operations: [
        {
          opId: 'c1-edit',
          branchId: 'branch-1',
          clientId: 'client-1',
          lamportTime: 2,
          type: 'update_content',
          nodeId: 'node-1',
          content: 'Stale Edit from Client 1',
        },
      ],
    });

    let branch = server.getBranch('branch-1');
    expect(branch?.tree.nodes.get('node-1')?.content).toBe('Winning Edit from Client 2');

    // Client-2 deletes the node
    server.sync({
      branchId: 'branch-1',
      clientId: 'client-2',
      baseRevision: 3,
      operations: [
        {
          opId: 'c2-del',
          branchId: 'branch-1',
          clientId: 'client-2',
          lamportTime: 6,
          type: 'delete_node',
          nodeId: 'node-1',
        },
      ],
    });

    // Client-1 tries to update the tombstoned node
    server.sync({
      branchId: 'branch-1',
      clientId: 'client-1',
      baseRevision: 3,
      operations: [
        {
          opId: 'c1-resurrect',
          branchId: 'branch-1',
          clientId: 'client-1',
          lamportTime: 7,
          type: 'update_content',
          nodeId: 'node-1',
          content: 'Resurrect Attempt',
        },
      ],
    });

    branch = server.getBranch('branch-1');
    expect(branch?.tree.nodes.get('node-1')?.isDeleted).toBe(true);
    expect(branch?.tree.nodes.get('node-1')?.content).toBe('Winning Edit from Client 2');
  });

  it('rejects move operations that would create cycles', () => {
    const server = new BranchServer();

    // Create root-1 -> node-A -> node-B
    server.sync(
      {
        branchId: 'branch-1',
        clientId: 'client-1',
        baseRevision: 0,
        operations: [
          {
            opId: 'create-A',
            branchId: 'branch-1',
            clientId: 'client-1',
            lamportTime: 1,
            type: 'create_node',
            nodeId: 'node-A',
            parentId: 'root-1',
            content: 'Node A',
            orderKey: 'a0',
          },
          {
            opId: 'create-B',
            branchId: 'branch-1',
            clientId: 'client-1',
            lamportTime: 2,
            type: 'create_node',
            nodeId: 'node-B',
            parentId: 'node-A',
            content: 'Node B',
            orderKey: 'a0',
          },
        ],
      },
      'root-1'
    );

    // Attempt to move node-A to be a child of node-B (would create cycle: A -> B -> A)
    const response = server.sync({
      branchId: 'branch-1',
      clientId: 'client-2',
      baseRevision: 2,
      operations: [
        {
          opId: 'cycle-move',
          branchId: 'branch-1',
          clientId: 'client-2',
          lamportTime: 3,
          type: 'move_node',
          nodeId: 'node-A',
          newParentId: 'node-B',
          newOrderKey: 'a0',
        },
      ],
    });

    expect(response.rejectedOps).toEqual([
      { opId: 'cycle-move', reason: 'cycle_detected' },
    ]);
    expect(response.acceptedOpIds).toEqual([]);

    // Node A's parent must still be root-1
    const branch = server.getBranch('branch-1');
    expect(branch?.tree.nodes.get('node-A')?.parentId).toBe('root-1');
  });

  it('reparents child nodes to the branch root if the parent was concurrently deleted', () => {
    const server = new BranchServer();

    // Create root-1 -> parent-node
    server.sync(
      {
        branchId: 'branch-1',
        clientId: 'client-1',
        baseRevision: 0,
        operations: [
          {
            opId: 'create-p',
            branchId: 'branch-1',
            clientId: 'client-1',
            lamportTime: 1,
            type: 'create_node',
            nodeId: 'parent-node',
            parentId: 'root-1',
            content: 'Parent',
            orderKey: 'a0',
          },
        ],
      },
      'root-1'
    );

    // Client-2 concurrently deletes parent-node
    server.sync({
      branchId: 'branch-1',
      clientId: 'client-2',
      baseRevision: 1,
      operations: [
        {
          opId: 'delete-p',
          branchId: 'branch-1',
          clientId: 'client-2',
          lamportTime: 2,
          type: 'delete_node',
          nodeId: 'parent-node',
        },
      ],
    });

    // Client-1 (offline) created a child under parent-node and now syncs
    const response = server.sync({
      branchId: 'branch-1',
      clientId: 'client-1',
      baseRevision: 1,
      operations: [
        {
          opId: 'create-c',
          branchId: 'branch-1',
          clientId: 'client-1',
          lamportTime: 3,
          type: 'create_node',
          nodeId: 'child-node',
          parentId: 'parent-node',
          content: 'Important Offline Notes',
          orderKey: 'a0',
        },
      ],
    });

    expect(response.acceptedOpIds).toContain('create-c');

    const branch = server.getBranch('branch-1');
    const childNode = branch?.tree.nodes.get('child-node');
    expect(childNode?.isDeleted).toBe(false);
    expect(childNode?.content).toBe('Important Offline Notes');
    // Safely reparented to branch root
    expect(childNode?.parentId).toBe('root-1');
  });
});



