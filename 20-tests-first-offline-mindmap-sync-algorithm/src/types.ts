export interface MindmapNode {
  id: string;
  parentId: string | null;
  content: string;
  orderKey: string;
  isDeleted: boolean;
}

export interface BranchTree {
  branchId: string;
  rootNodeId: string;
  nodes: Map<string, MindmapNode>;
}

export interface CreateNodeParams {
  id?: string;
  parentId: string;
  content?: string;
  afterNodeId?: string;
  beforeNodeId?: string;
}

export interface BaseOperation {
  opId: string;
  branchId: string;
  clientId: string;
  lamportTime: number;
}

export interface CreateNodeOp extends BaseOperation {
  type: 'create_node';
  nodeId: string;
  parentId: string;
  content: string;
  orderKey: string;
}

export interface UpdateContentOp extends BaseOperation {
  type: 'update_content';
  nodeId: string;
  content: string;
}

export interface MoveNodeOp extends BaseOperation {
  type: 'move_node';
  nodeId: string;
  newParentId: string;
  newOrderKey: string;
}

export interface DeleteNodeOp extends BaseOperation {
  type: 'delete_node';
  nodeId: string;
}

export type Operation = CreateNodeOp | UpdateContentOp | MoveNodeOp | DeleteNodeOp;

export interface SyncRequest {
  branchId: string;
  clientId: string;
  baseRevision: number;
  operations: Operation[];
}

export interface RejectedOperation {
  opId: string;
  reason: 'cycle_detected' | 'tombstone_target' | 'invalid_parent';
}

export interface SyncResponse {
  branchId: string;
  headRevision: number;
  acceptedOpIds: string[];
  rejectedOps: RejectedOperation[];
  remoteOperations: Operation[];
}
