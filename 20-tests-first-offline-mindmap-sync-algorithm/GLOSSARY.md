# Mindmap Synchronization

The offline-first synchronization domain for mindmaps, reconciling distributed edits to mindmap branches across offline clients and a central server.

## Language

**Mindmap**:
A visual hierarchical document organized around a single central root node.
_Avoid_: Diagram, canvas, graph

**Branch**:
An independent subtree stemming directly from the central root node of a mindmap, serving as the unit of synchronization.
_Avoid_: Topic, section, sub-tree

**Node**:
A single topic or thought within a branch, possessing an identity, textual content, hierarchical parentage, and sibling order rank.
_Avoid_: Item, vertex, element, card

**Operation**:
An immutable record of an atomic user action modifying a node or its position within a branch, tagged with a Lamport timestamp and client identifier.
_Avoid_: Action, mutation, event, change

**Lamport Timestamp**:
A monotonically increasing logical counter guaranteeing causal ordering of operations across distributed clients without reliance on physical wall clocks.
_Avoid_: Wall clock, timestamp, sequence number

**Fractional Index**:
A lexicographically sortable string representing a node's relative position among siblings, allowing concurrent insertions without collision or re-indexing.
_Avoid_: Order index, position number, rank integer

**Tombstone**:
A marker recording the deletion of a node to prevent its accidental resurrection by concurrent offline edits.
_Avoid_: Soft delete, ghost node

**Cycle**:
An invalid circular ancestor-descendant relationship created when concurrent move operations invert parentage.
_Avoid_: Loop, circular reference

**Orphan Node**:
A node whose parent was concurrently deleted, recovered by reparenting directly to the branch root to prevent data loss.
_Avoid_: Dangling node, lost node

**Revision**:
A monotonically increasing integer tracking the authoritative state of a branch on the server.
_Avoid_: Version, hash, sequence

**Sync Session**:
A client-initiated exchange reconciling uncommitted local operations for a specific branch against authoritative server operations.
_Avoid_: Push/pull, upload, replication cycle

**Uncommitted Queue**:
The client-side buffer of local operations created while offline or awaiting server acknowledgment.
_Avoid_: Pending changes, outbox, local buffer
