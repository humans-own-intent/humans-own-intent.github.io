# Static Web Mindmap Viewer

A lightweight, zero-build, offline-first static web mindmap viewer.

Ingest and explore hierarchical mindmap files (JSON or YAML) with rich metadata, interactive D3.js SVG tree navigation, real-time search with ancestor auto-expansion, and deep attribute inspection.

---

## Features

- **Offline-First Zero-Build**: Pure ES6+ JavaScript, modern CSS, and HTML5. Vendored local dependencies (`vendor/d3.v7.min.js`, `vendor/js-yaml.min.js`) ensure complete functionality without internet access or build tools.
- **Dual Format Support**: Accepts `.json`, `.yaml`, and `.yml` files via drag-and-drop or file picker.
- **Lenient Schema Normalization**: Seamlessly resolves common tree naming variations:
  - Node Labels: `label` || `name` || `title` || `topic` || `text` || `id`
  - Hierarchy Links: `children` || `nodes` || `subtopics` || `items` || `branches`
  - Custom Attributes: Preserves arbitrary custom key-value pairs (notes, tags, status, priority, urls, etc.).
- **Interactive D3 SVG Tree**:
  - Horizontal hierarchical layout with smooth pan and zoom (`d3.zoom`).
  - Curved bezier links (`d3.linkHorizontal`).
  - Animated branch collapse/expand with child-count badges.
  - Initial load expands to depth 1, keeping complex trees clean and readable.
- **Real-Time Search & Discovery**:
  - Searches node titles, notes, tags, and custom metadata.
  - Auto-expands collapsed ancestor branches leading to search matches.
  - Highlights matched cards with a match counter badge.
  - Shortcuts: Press `/` or `Ctrl+K` to search, `Esc` to clear.
- **Bottom Details Panel**:
  - Collapsible/minimizable bottom dock.
  - Formats markdown/multiline notes, status chips, and tag pills.
  - Automatically turns URLs into clickable external links.
  - Renders all custom attributes in an organized key-value table.
- **Empty State Sandbox**:
  - Centered dropzone card with one-click "Load Sample Mindmap" button.
- **Non-Destructive Error Diagnostics**:
  - Helpful toast alerts displaying syntax or schema error details without blanking the canvas.

---

## Directory Structure

```
10-static-web-mindmap-viewer/
├── GLOSSARY.md                             # Canonical domain vocabulary
├── docs/
│   └── adr/
│       ├── 0001-zero-build-offline-architecture.md
│       └── 0002-read-only-viewer-scope.md
├── index.html                              # Main HTML entry point
├── css/
│   ├── main.css                            # Layout, navbar, controls, dropzone, toast
│   ├── mindmap.css                         # D3 SVG canvas, cards, badges, links, states
│   └── panel.css                           # Bottom details panel, table, chips, markdown
├── js/
│   ├── app.js                              # Application coordinator & event wiring
│   ├── parser.js                           # JSON & YAML lenient tree normalizer
│   ├── mindmap.js                          # D3 horizontal tree renderer
│   ├── search.js                           # Search indexing & ancestor auto-expansion
│   ├── panel.js                            # Details panel controller
│   └── sample-data.js                      # Built-in rich demo mindmap
├── vendor/
│   ├── d3.v7.min.js                        # Vendored D3 v7
│   └── js-yaml.min.js                      # Vendored js-yaml v4
└── examples/
    ├── cloud-architecture.json             # Example JSON mindmap
    └── ai-agent-roadmap.yaml               # Example YAML mindmap
```

---

## Getting Started

Because the application is completely zero-build, you can serve it with any local static HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Or using Node npx
npx serve .
```

Then open `http://localhost:8080` in your web browser.

Click **"Load Sample Mindmap"** to immediately explore features, or drag and drop any file from the `examples/` directory.
