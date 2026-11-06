# Branch-Level Synchronization for Mindmaps

## Context and Decision
A mindmap consists of a central root node and multiple hierarchical branches radiating from it. We decided to make the individual **Branch** (rather than the entire mindmap document or individual nodes) the fundamental unit of offline-first synchronization. Each branch syncs independently using an operation-based log with Lamport logical clocks, Last-Write-Wins property updates, and fractional indexing for sibling ordering.

## Considered Options
- **Full-Document Synchronization**: Syncing the whole mindmap snapshot or unified log. Rejected because it incurs high bandwidth overhead for large mindmaps on intermittent mobile connections and causes document-level lockups or merge complexity.
- **Node-by-Node Synchronization**: Syncing individual nodes independently. Rejected because hierarchical tree relationships (parent-child links, sibling ordering) cannot be validated atomically, leading to orphan subtrees and frequent cycles.

## Consequences
- Synchronization payloads are small and fast, isolated to active branches.
- Clients can edit and synchronize one branch without locking or fetching other untouched branches.
- Cross-branch node movement cannot be executed as a single atomic operation; it must be decomposed into a deletion in the source branch and creation in the target branch.
