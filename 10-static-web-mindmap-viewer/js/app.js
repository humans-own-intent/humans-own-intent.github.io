/**
 * app.js - Main Application Coordinator
 * Wires together ingestion, parser, renderer, search, details panel, and UI controls.
 */

import { MindmapParser } from './parser.js';
import { MindmapRenderer } from './mindmap.js';
import { MindmapSearch } from './search.js';
import { DetailsPanel } from './panel.js';
import { SAMPLE_MINDMAP } from './sample-data.js';

class MindmapApp {
  constructor() {
    this.currentData = null;
    this.initElements();
    this.initComponents();
    this.bindEvents();
  }

  initElements() {
    this.dropzone = document.getElementById('dropzone');
    this.btnLoadSample = document.getElementById('btn-load-sample');
    this.fileInput = document.getElementById('file-input');
    this.btnOpenFile = document.getElementById('btn-open-file');
    this.toast = document.getElementById('error-toast');
    this.toastMessage = document.getElementById('toast-message');
    this.toastClose = document.getElementById('toast-close');

    // Search controls
    this.searchInput = document.getElementById('search-input');
    this.btnClearSearch = document.getElementById('btn-clear-search');
    this.searchCountBadge = document.getElementById('search-count-badge');

    // Toolbar controls
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnFitView = document.getElementById('btn-fit-view');
    this.btnExpandAll = document.getElementById('btn-expand-all');
    this.btnCollapseAll = document.getElementById('btn-collapse-all');

    // Status bar / title
    this.mapTitle = document.getElementById('map-title');
    this.nodeCountBadge = document.getElementById('node-count-badge');
  }

  initComponents() {
    // Details Panel
    this.panel = new DetailsPanel(document.getElementById('details-panel'), {
      onClose: () => {
        if (this.renderer) {
          this.renderer.selectNode(null);
        }
      }
    });

    // Renderer
    this.renderer = new MindmapRenderer(document.getElementById('canvas-container'), {
      onNodeSelected: (nodeData) => {
        this.panel.showNode(nodeData);
      },
      onBranchToggled: () => {
        // Update view if needed
      }
    });

    // Search
    this.search = new MindmapSearch(this.renderer);
  }

  bindEvents() {
    // Sample Mindmap Button
    this.btnLoadSample.addEventListener('click', () => {
      this.loadSampleData();
    });

    // Open File Button (Navbar)
    this.btnOpenFile.addEventListener('click', () => {
      this.fileInput.value = '';
      this.fileInput.click();
    });

    // File Input Changed
    this.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    // Drag and Drop (Window-wide and Dropzone)
    ['dragenter', 'dragover'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.body.classList.add('drag-active');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      window.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.target === document.body || !e.relatedTarget) {
          document.body.classList.remove('drag-active');
        }
      }, false);
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.body.classList.remove('drag-active');

      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    // Search Input
    let searchDebounce = null;
    this.searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        this.handleSearch();
      }, 150);
    });

    this.btnClearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.handleSearch();
      this.searchInput.focus();
    });

    // Canvas Toolbar Buttons
    this.btnZoomIn.addEventListener('click', () => this.renderer.zoomIn());
    this.btnZoomOut.addEventListener('click', () => this.renderer.zoomOut());
    this.btnFitView.addEventListener('click', () => this.renderer.fitView(400));
    this.btnExpandAll.addEventListener('click', () => this.renderer.expandAll());
    this.btnCollapseAll.addEventListener('click', () => this.renderer.collapseAll());

    // Toast Close
    this.toastClose.addEventListener('click', () => {
      this.hideToast();
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Focus search: '/' or Ctrl/Cmd + K
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && document.activeElement !== this.searchInput) {
        e.preventDefault();
        this.searchInput.focus();
        this.searchInput.select();
      }

      // Escape key: clear search or deselect
      if (e.key === 'Escape') {
        if (this.searchInput.value) {
          this.searchInput.value = '';
          this.handleSearch();
          this.searchInput.blur();
        } else if (this.panel.currentNode) {
          this.panel.clear();
          this.renderer.selectNode(null);
        }
      }
    });
  }

  loadSampleData() {
    try {
      const parsed = MindmapParser.parse(JSON.stringify(SAMPLE_MINDMAP), 'sample.json');
      this.displayMindmap(parsed, 'Cloud Infrastructure Architecture (Sample)');
    } catch (err) {
      this.showToast(`Error loading sample: ${err.message}`);
    }
  }

  loadFile(file) {
    const filename = file.name || 'mindmap';
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = MindmapParser.parse(text, filename);
        this.displayMindmap(parsed, filename);
      } catch (err) {
        this.showToast(`Parse Error: ${err.message}`);
      }
    };

    reader.onerror = () => {
      this.showToast(`Failed to read file "${filename}".`);
    };

    reader.readAsText(file);
  }

  displayMindmap(parsedData, label) {
    this.currentData = parsedData;

    // Hide dropzone
    this.dropzone.classList.add('hidden');

    // Update Header
    this.mapTitle.textContent = parsedData.root.label || label;
    this.mapTitle.title = this.mapTitle.textContent;
    this.nodeCountBadge.textContent = `${parsedData.nodeCount} nodes`;
    this.nodeCountBadge.style.display = 'inline-block';

    // Clear previous search & panel state
    this.searchInput.value = '';
    this.searchCountBadge.style.display = 'none';
    this.btnClearSearch.style.display = 'none';
    this.panel.clear();

    // Render tree
    this.renderer.setData(parsedData.root);

    // Build Search Index
    this.search.buildIndex(parsedData.root);
  }

  handleSearch() {
    const query = this.searchInput.value.trim();

    if (!query) {
      this.search.clear();
      this.searchCountBadge.style.display = 'none';
      this.btnClearSearch.style.display = 'none';
      return;
    }

    this.btnClearSearch.style.display = 'inline-flex';
    const result = this.search.search(query);

    this.searchCountBadge.textContent = `${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`;
    this.searchCountBadge.style.display = 'inline-block';

    if (result.matchCount === 0) {
      this.searchCountBadge.classList.add('no-matches');
    } else {
      this.searchCountBadge.classList.remove('no-matches');
    }
  }

  showToast(message) {
    this.toastMessage.textContent = message;
    this.toast.classList.remove('hidden');

    // Auto-hide after 8 seconds
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.hideToast();
    }, 8000);
  }

  hideToast() {
    this.toast.classList.add('hidden');
  }
}

// Bootstrap application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MindmapApp();
});
