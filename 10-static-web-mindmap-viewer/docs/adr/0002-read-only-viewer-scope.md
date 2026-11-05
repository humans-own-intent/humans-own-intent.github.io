# Read-Only Viewer Scope

We decided to strictly limit the viewer to client-side read-only visualization and attribute inspection, explicitly excluding in-browser node creation, editing, or hierarchy mutations. This trade-off prevents the need for complex state management, undo/redo stacks, and serialization round-tripping, keeping the runtime lean, fast, and focused on large-scale exploration and analysis of existing mindmap files.
