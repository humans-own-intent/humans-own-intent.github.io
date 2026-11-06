import { generateFractionalKey } from './fractional-index.js';
import { generateRandomNodeTitle } from './random-title.js';
import {
  BranchTree,
  CreateNodeParams,
  MindmapNode,
  Operation,
  SyncRequest,
  SyncResponse,
} from './types.js';

export interface BranchClientOptions {
  clientId: string;
  branchId: string;
  branchRootId: string;
  initialRevision?: number;
}

interface NodeMetadata {
  contentLamport: number;
  contentClientId: string;
  moveLamport: number;
  moveClientId: string;
}

export class BranchClient {
  readonly clientId: string;
  readonly branchId: string;
  readonly branchRootId: string;

  private authoritativeRevision: number;
  private lamportClock = 0;
  private opCounter = 0;
  private nextNodeNum = 1;

  private authoritativeNodes: Map<string, MindmapNode> = new Map();
  private authoritativeMetadata: Map<string, NodeMetadata> = new Map();

  private workingNodes: Map<string, MindmapNode> = new Map();
  private workingMetadata: Map<string, NodeMetadata> = new Map();

  private uncommittedOps: Operation[] = [];

  constructor(options: BranchClientOptions) {
    this.clientId = options.clientId;
    this.branchId = options.branchId;
    this.branchRootId = options.branchRootId;
    this.authoritativeRevision = options.initialRevision ?? 0;

    // Initialize root node for the branch in authoritative state
    this.authoritativeNodes.set(this.branchRootId, {
      id: this.branchRootId,
      parentId: null,
      content: 'Branch Root',
      orderKey: 'a0',
      isDeleted: false,
    });
    this.authoritativeMetadata.set(this.branchRootId, {
      contentLamport: 0,
      contentClientId: 'server',
      moveLamport: 0,
      moveClientId: 'server',
    });

    this.rebuildWorkingTree();
  }

  private nextLamport(): number {
    return ++this.lamportClock;
  }

  private nextOpId(): string {
    return `${this.clientId}-op-${++this.opCounter}`;
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

  wouldCreateCycle(
    nodeId: string,
    newParentId: string,
    nodesMap: Map<string, MindmapNode> = this.workingNodes
  ): boolean {
    if (nodeId === newParentId) return true;
    let current: string | null = newParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === nodeId) return true;
      if (visited.has(current)) break;
      visited.add(current);
      const parentNode = nodesMap.get(current);
      current = parentNode?.parentId ?? null;
    }
    return false;
  }

  private rebuildWorkingTree(): void {
    this.workingNodes = new Map();
    for (const [id, node] of this.authoritativeNodes.entries()) {
      this.workingNodes.set(id, { ...node });
    }

    this.workingMetadata = new Map();
    for (const [id, meta] of this.authoritativeMetadata.entries()) {
      this.workingMetadata.set(id, { ...meta });
    }

    for (const op of this.uncommittedOps) {
      this.applyOperationToState(this.workingNodes, this.workingMetadata, op);
    }
  }

  getChildren(parentId: string): MindmapNode[] {
    const children: MindmapNode[] = [];
    for (const node of this.workingNodes.values()) {
      if (node.parentId === parentId && !node.isDeleted) {
        children.push(node);
      }
    }
    return children.sort((a, b) => {
      if (a.orderKey < b.orderKey) return -1;
      if (a.orderKey > b.orderKey) return 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }

  createNode(params: CreateNodeParams): MindmapNode {
    const id = params.id ?? `${this.clientId}-node-${this.nextNodeNum++}`;

    let lowKey: string | null = null;
    let highKey: string | null = null;

    if (params.afterNodeId) {
      lowKey = this.workingNodes.get(params.afterNodeId)?.orderKey ?? null;
    }
    if (params.beforeNodeId) {
      highKey = this.workingNodes.get(params.beforeNodeId)?.orderKey ?? null;
    }

    if (!params.afterNodeId && !params.beforeNodeId) {
      const existingChildren = this.getChildren(params.parentId);
      if (existingChildren.length > 0) {
        lowKey = existingChildren[existingChildren.length - 1].orderKey;
      }
    }

    const orderKey = generateFractionalKey(lowKey, highKey);
    const content = params.content ?? generateRandomNodeTitle();
    const lamport = this.nextLamport();

    const op: Operation = {
      opId: this.nextOpId(),
      type: 'create_node',
      branchId: this.branchId,
      clientId: this.clientId,
      lamportTime: lamport,
      nodeId: id,
      parentId: params.parentId,
      content,
      orderKey,
    };

    this.uncommittedOps.push(op);
    this.applyOperationToState(this.workingNodes, this.workingMetadata, op);

    return this.workingNodes.get(id)!;
  }

  updateNode(nodeId: string, content: string): void {
    const existing = this.workingNodes.get(nodeId);
    if (!existing || existing.isDeleted) {
      return;
    }

    const lamport = this.nextLamport();
    const op: Operation = {
      opId: this.nextOpId(),
      type: 'update_content',
      branchId: this.branchId,
      clientId: this.clientId,
      lamportTime: lamport,
      nodeId,
      content,
    };

    this.uncommittedOps.push(op);
    this.applyOperationToState(this.workingNodes, this.workingMetadata, op);
  }

  moveNode(
    nodeId: string,
    newParentId: string,
    options?: { afterNodeId?: string; beforeNodeId?: string }
  ): boolean {
    const existing = this.workingNodes.get(nodeId);
    if (!existing || existing.isDeleted) {
      return false;
    }

    if (this.wouldCreateCycle(nodeId, newParentId, this.workingNodes)) {
      return false;
    }

    let lowKey: string | null = null;
    let highKey: string | null = null;

    if (options?.afterNodeId) {
      lowKey = this.workingNodes.get(options.afterNodeId)?.orderKey ?? null;
    }
    if (options?.beforeNodeId) {
      highKey = this.workingNodes.get(options.beforeNodeId)?.orderKey ?? null;
    }

    if (!options?.afterNodeId && !options?.beforeNodeId) {
      const existingChildren = this.getChildren(newParentId);
      if (existingChildren.length > 0) {
        lowKey = existingChildren[existingChildren.length - 1].orderKey;
      }
    }

    const newOrderKey = generateFractionalKey(lowKey, highKey);
    const lamport = this.nextLamport();

    const op: Operation = {
      opId: this.nextOpId(),
      type: 'move_node',
      branchId: this.branchId,
      clientId: this.clientId,
      lamportTime: lamport,
      nodeId,
      newParentId,
      newOrderKey,
    };

    this.uncommittedOps.push(op);
    this.applyOperationToState(this.workingNodes, this.workingMetadata, op);
    return true;
  }

  deleteNode(nodeId: string): void {
    const existing = this.workingNodes.get(nodeId);
    if (!existing || existing.isDeleted) {
      return;
    }

    const lamport = this.nextLamport();
    const op: Operation = {
      opId: this.nextOpId(),
      type: 'delete_node',
      branchId: this.branchId,
      clientId: this.clientId,
      lamportTime: lamport,
      nodeId,
    };

    this.uncommittedOps.push(op);
    this.applyOperationToState(this.workingNodes, this.workingMetadata, op);
  }

  prepareSync(): SyncRequest {
    return {
      branchId: this.branchId,
      clientId: this.clientId,
      baseRevision: this.authoritativeRevision,
      operations: [...this.uncommittedOps],
    };
  }

  applySyncResponse(response: SyncResponse): void {
    this.authoritativeRevision = response.headRevision;

    const acceptedSet = new Set(response.acceptedOpIds);
    const rejectedSet = new Set(response.rejectedOps.map(r => r.opId));

    // 1. Apply remote operations committed on the server before our batch
    for (const remoteOp of response.remoteOperations) {
      this.lamportClock = Math.max(this.lamportClock, remoteOp.lamportTime);
      this.applyOperationToState(this.authoritativeNodes, this.authoritativeMetadata, remoteOp);
    }

    // 2. Apply our own accepted operations to authoritative state
    for (const localOp of this.uncommittedOps) {
      if (acceptedSet.has(localOp.opId)) {
        this.applyOperationToState(this.authoritativeNodes, this.authoritativeMetadata, localOp);
      }
    }

    // 3. Remove both accepted and rejected operations from the uncommitted queue
    this.uncommittedOps = this.uncommittedOps.filter(
      op => !acceptedSet.has(op.opId) && !rejectedSet.has(op.opId)
    );

    // 4. Rebase working tree: AuthoritativeState + remaining UncommittedQueue
    this.rebuildWorkingTree();
  }

  private applyOperationToState(
    nodes: Map<string, MindmapNode>,
    metadata: Map<string, NodeMetadata>,
    op: Operation
  ): void {
    const meta = metadata.get(op.nodeId);

    switch (op.type) {
      case 'create_node': {
        const parent = nodes.get(op.parentId);
        const effectiveParentId = !parent || parent.isDeleted ? this.branchRootId : op.parentId;

        nodes.set(op.nodeId, {
          id: op.nodeId,
          parentId: effectiveParentId,
          content: op.content,
          orderKey: op.orderKey,
          isDeleted: false,
        });
        metadata.set(op.nodeId, {
          contentLamport: op.lamportTime,
          contentClientId: op.clientId,
          moveLamport: op.lamportTime,
          moveClientId: op.clientId,
        });
        break;
      }
      case 'update_content': {
        const node = nodes.get(op.nodeId);
        if (node && !node.isDeleted) {
          if (
            this.isNewer(
              op.lamportTime,
              op.clientId,
              meta?.contentLamport,
              meta?.contentClientId
            )
          ) {
            node.content = op.content;
            metadata.set(op.nodeId, {
              contentLamport: op.lamportTime,
              contentClientId: op.clientId,
              moveLamport: meta?.moveLamport ?? 0,
              moveClientId: meta?.moveClientId ?? '',
            });
          }
        }
        break;
      }
      case 'move_node': {
        const node = nodes.get(op.nodeId);
        if (node && !node.isDeleted) {
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
                ? this.branchRootId
                : op.newParentId;

            if (!this.wouldCreateCycle(op.nodeId, effectiveParentId, nodes)) {
              node.parentId = effectiveParentId;
              node.orderKey = op.newOrderKey;
              metadata.set(op.nodeId, {
                contentLamport: meta?.contentLamport ?? 0,
                contentClientId: meta?.contentClientId ?? '',
                moveLamport: op.lamportTime,
                moveClientId: op.clientId,
              });
            }
          }
        }
        break;
      }
      case 'delete_node': {
        const node = nodes.get(op.nodeId);
        if (node) {
          node.isDeleted = true;
          metadata.set(op.nodeId, {
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

  getWorkingTree(): BranchTree {
    return {
      branchId: this.branchId,
      rootNodeId: this.branchRootId,
      nodes: new Map(this.workingNodes),
    };
  }
}
