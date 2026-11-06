import {
  BranchTree,
  MindmapNode,
  Operation,
  RejectedOperation,
  SyncRequest,
  SyncResponse,
} from './types.js';

export interface NodeMetadata {
  contentLamport: number;
  contentClientId: string;
  moveLamport: number;
  moveClientId: string;
}

export interface CommittedOperation {
  revision: number;
  op: Operation;
}

export interface ServerBranchState {
  branchId: string;
  rootNodeId: string;
  revision: number;
  tree: BranchTree;
  opLog: CommittedOperation[];
  nodeMetadata: Map<string, NodeMetadata>;
}

export class BranchServer {
  private branches: Map<string, ServerBranchState> = new Map();

  getBranch(branchId: string): ServerBranchState | null {
    const branch = this.branches.get(branchId);
    if (!branch) return null;
    return {
      branchId: branch.branchId,
      rootNodeId: branch.rootNodeId,
      revision: branch.revision,
      tree: {
        branchId: branch.tree.branchId,
        rootNodeId: branch.tree.rootNodeId,
        nodes: new Map(branch.tree.nodes),
      },
      opLog: [...branch.opLog],
      nodeMetadata: new Map(branch.nodeMetadata),
    };
  }

  private initBranch(branchId: string, rootNodeId: string): ServerBranchState {
    const rootNode: MindmapNode = {
      id: rootNodeId,
      parentId: null,
      content: 'Branch Root',
      orderKey: 'a0',
      isDeleted: false,
    };
    const state: ServerBranchState = {
      branchId,
      rootNodeId,
      revision: 0,
      tree: {
        branchId,
        rootNodeId,
        nodes: new Map([[rootNodeId, rootNode]]),
      },
      opLog: [],
      nodeMetadata: new Map([
        [
          rootNodeId,
          {
            contentLamport: 0,
            contentClientId: 'server',
            moveLamport: 0,
            moveClientId: 'server',
          },
        ],
      ]),
    };
    this.branches.set(branchId, state);
    return state;
  }

  private isNewer(
    lamport: number,
    clientId: string,
    lastLamport?: number,
    lastClientId?: string
  ): boolean {
    if (lastLamport === undefined || lastClientId === undefined) return true;
    if (lamport > lastLamport) return true;
    if (lamport === lastLamport) return clientId > lastClientId;
    return false;
  }

  private wouldCreateCycle(
    nodes: Map<string, MindmapNode>,
    nodeId: string,
    newParentId: string
  ): boolean {
    if (nodeId === newParentId) return true;
    let current: string | null = newParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === nodeId) return true;
      if (visited.has(current)) break;
      visited.add(current);
      const parentNode = nodes.get(current);
      current = parentNode?.parentId ?? null;
    }
    return false;
  }

  sync(request: SyncRequest, defaultRootId: string = 'root'): SyncResponse {
    let branch = this.branches.get(request.branchId);
    if (!branch) {
      branch = this.initBranch(request.branchId, defaultRootId);
    }

    const acceptedOpIds: string[] = [];
    const rejectedOps: RejectedOperation[] = [];

    // Collect remote operations committed since client's baseRevision
    const remoteOps: Operation[] = branch.opLog
      .filter(
        entry =>
          entry.revision > request.baseRevision && entry.op.clientId !== request.clientId
      )
      .map(entry => entry.op);

    for (const op of request.operations) {
      if (op.type === 'move_node') {
        if (this.wouldCreateCycle(branch.tree.nodes, op.nodeId, op.newParentId)) {
          rejectedOps.push({ opId: op.opId, reason: 'cycle_detected' });
          continue;
        }
      }

      this.applyOperation(branch, op);
      branch.revision += 1;
      branch.opLog.push({ revision: branch.revision, op });
      acceptedOpIds.push(op.opId);
    }

    return {
      branchId: request.branchId,
      headRevision: branch.revision,
      acceptedOpIds,
      rejectedOps,
      remoteOperations: remoteOps,
    };
  }

  private applyOperation(branch: ServerBranchState, op: Operation): void {
    const nodes = branch.tree.nodes;
    const meta = branch.nodeMetadata.get(op.nodeId);

    switch (op.type) {
      case 'create_node': {
        const parent = nodes.get(op.parentId);
        const effectiveParentId =
          !parent || parent.isDeleted ? branch.rootNodeId : op.parentId;

        const node: MindmapNode = {
          id: op.nodeId,
          parentId: effectiveParentId,
          content: op.content,
          orderKey: op.orderKey,
          isDeleted: false,
        };
        nodes.set(op.nodeId, node);
        branch.nodeMetadata.set(op.nodeId, {
          contentLamport: op.lamportTime,
          contentClientId: op.clientId,
          moveLamport: op.lamportTime,
          moveClientId: op.clientId,
        });
        break;
      }
      case 'update_content': {
        const existing = nodes.get(op.nodeId);
        if (!existing || existing.isDeleted) {
          return;
        }
        if (
          this.isNewer(
            op.lamportTime,
            op.clientId,
            meta?.contentLamport,
            meta?.contentClientId
          )
        ) {
          existing.content = op.content;
          branch.nodeMetadata.set(op.nodeId, {
            contentLamport: op.lamportTime,
            contentClientId: op.clientId,
            moveLamport: meta?.moveLamport ?? 0,
            moveClientId: meta?.moveClientId ?? '',
          });
        }
        break;
      }
      case 'move_node': {
        const existing = nodes.get(op.nodeId);
        if (!existing || existing.isDeleted) {
          return;
        }
        if (
          this.isNewer(
            op.lamportTime,
            op.clientId,
            meta?.moveLamport,
            meta?.moveClientId
          )
        ) {
          const targetParent = nodes.get(op.newParentId);
          const effectiveParentId =
            !targetParent || targetParent.isDeleted
              ? branch.rootNodeId
              : op.newParentId;

          if (!this.wouldCreateCycle(nodes, op.nodeId, effectiveParentId)) {
            existing.parentId = effectiveParentId;
            existing.orderKey = op.newOrderKey;
            branch.nodeMetadata.set(op.nodeId, {
              contentLamport: meta?.contentLamport ?? 0,
              contentClientId: meta?.contentClientId ?? '',
              moveLamport: op.lamportTime,
              moveClientId: op.clientId,
            });
          }
        }
        break;
      }
      case 'delete_node': {
        const existing = nodes.get(op.nodeId);
        if (existing) {
          existing.isDeleted = true;
          branch.nodeMetadata.set(op.nodeId, {
            contentLamport: Math.max(meta?.contentLamport ?? 0, op.lamportTime),
            contentClientId: op.clientId,
            moveLamport: Math.max(meta?.moveLamport ?? 0, op.lamportTime),
            moveClientId: op.clientId,
          });
        }
        break;
      }
    }
  }
}
