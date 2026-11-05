# Mindmap Viewer

A static client-side web application for visualizing, searching, and inspecting hierarchical mindmap data.

## Language

**Mindmap**:
The complete hierarchical document and visual tree structure.
_Avoid_: Graph, chart, diagram

**Node**:
An individual entity in the hierarchy containing a label, child links, and attributes.
_Avoid_: Card, item, vertex, topic

**Root Node**:
The single top-level node in the hierarchy from which all branches emanate.
_Avoid_: Origin, head, parent

**Branch**:
An internal node and all of its descendants, toggleable between expanded and collapsed states.
_Avoid_: Subtree, cluster

**Ancestor Path**:
The ordered sequence of nodes connecting the Root Node to a specific descendant Node.
_Avoid_: Parent chain, lineage, breadcrumb

**Collapsed State**:
A display state where a Branch's child nodes are hidden from view.
_Avoid_: Folded, closed, hidden

**Expanded State**:
A display state where a Branch's child nodes are visible.
_Avoid_: Unfolded, open

**Leaf**:
A terminal node in the hierarchy with no children.
_Avoid_: End node

**Attribute**:
Any metadata property attached to a node, such as notes, tags, status, or arbitrary key-value pairs.
_Avoid_: Property, field, parameter

**Details Panel**:
The dedicated viewport area displaying a selected node's full metadata and attributes.
_Avoid_: Inspector, drawer, sidebar, tooltip
