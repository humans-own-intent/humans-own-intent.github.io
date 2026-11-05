/**
 * panel.js - Bottom Details Panel Controller
 * Formats notes, tags, statuses, and custom key-value pairs for the selected node.
 */

export class DetailsPanel {
  constructor(panelElement, options = {}) {
    this.panel = typeof panelElement === 'string'
      ? document.querySelector(panelElement)
      : panelElement;

    if (!this.panel) {
      throw new Error('DetailsPanel element not found.');
    }

    this.onClose = options.onClose || (() => {});
    this.isMinimized = false;
    this.currentNode = null;

    this.initElements();
  }

  initElements() {
    this.panel.innerHTML = `
      <div class="panel-header">
        <div class="panel-header-left">
          <span class="panel-title-badge">NODE INSPECTOR</span>
          <h3 class="panel-title" id="panel-node-title">No Node Selected</h3>
        </div>
        <div class="panel-header-right">
          <button class="panel-btn" id="panel-toggle-minimize" title="Minimize or Expand Panel">
            <span class="icon-minimize">▼</span>
          </button>
          <button class="panel-btn" id="panel-btn-close" title="Deselect Node">✕</button>
        </div>
      </div>
      <div class="panel-breadcrumb" id="panel-breadcrumb"></div>
      <div class="panel-body" id="panel-body">
        <div class="panel-placeholder">
          Click any node card on the mindmap to inspect its attributes, notes, and metadata.
        </div>
      </div>
    `;

    this.titleEl = this.panel.querySelector('#panel-node-title');
    this.breadcrumbEl = this.panel.querySelector('#panel-breadcrumb');
    this.bodyEl = this.panel.querySelector('#panel-body');
    this.toggleBtn = this.panel.querySelector('#panel-toggle-minimize');
    this.closeBtn = this.panel.querySelector('#panel-btn-close');

    this.toggleBtn.addEventListener('click', () => this.toggleMinimize());
    this.closeBtn.addEventListener('click', () => {
      this.clear();
      this.onClose();
    });
  }

  /**
   * Display details for a selected node
   * @param {object} nodeData - The normalized node object
   */
  showNode(nodeData) {
    this.currentNode = nodeData;
    if (this.isMinimized) {
      this.setMinimized(false);
    }

    this.titleEl.textContent = nodeData.label || 'Untitled Node';

    // Render breadcrumb path
    if (nodeData.path && nodeData.path.length > 0) {
      this.breadcrumbEl.innerHTML = nodeData.path
        .map((step, idx) => `<span class="breadcrumb-step ${idx === nodeData.path.length - 1 ? 'current' : ''}">${this.escapeHtml(step)}</span>`)
        .join('<span class="breadcrumb-sep"> / </span>');
      this.breadcrumbEl.style.display = 'block';
    } else {
      this.breadcrumbEl.style.display = 'none';
    }

    const attrs = nodeData.attributes || {};
    const notes = attrs.notes || attrs.description || attrs.desc || attrs.summary || '';
    const tags = Array.isArray(attrs.tags) ? attrs.tags : (attrs.tag ? [attrs.tag] : []);
    const status = attrs.status || attrs.state || null;
    const priority = attrs.priority || null;

    // Build custom attributes list (everything else)
    const knownKeys = new Set([
      'notes', 'description', 'desc', 'summary',
      'tags', 'tag', 'status', 'state', 'priority'
    ]);

    const customEntries = Object.entries(attrs).filter(([k]) => !knownKeys.has(k));

    let html = '';

    // Badges section (Status, Priority, Tags)
    if (status || priority || tags.length > 0) {
      html += '<div class="panel-chips-row">';

      if (status) {
        html += `<span class="badge-chip badge-status status-${this.slugify(status)}">Status: ${this.escapeHtml(String(status))}</span>`;
      }

      if (priority) {
        html += `<span class="badge-chip badge-priority priority-${this.slugify(priority)}">Priority: ${this.escapeHtml(String(priority))}</span>`;
      }

      for (const tag of tags) {
        html += `<span class="badge-chip badge-tag">#${this.escapeHtml(String(tag))}</span>`;
      }

      html += '</div>';
    }

    // Notes / Description section
    if (notes) {
      html += `
        <div class="panel-section">
          <h4 class="section-heading">Notes & Description</h4>
          <div class="notes-content">${this.formatNotes(String(notes))}</div>
        </div>
      `;
    }

    // Custom Key-Value Table
    if (customEntries.length > 0) {
      html += `
        <div class="panel-section">
          <h4 class="section-heading">Attributes & Metadata</h4>
          <table class="attributes-table">
            <thead>
              <tr><th>Attribute</th><th>Value</th></tr>
            </thead>
            <tbody>
      `;

      for (const [key, val] of customEntries) {
        html += `
          <tr>
            <td class="attr-key">${this.escapeHtml(key)}</td>
            <td class="attr-val">${this.formatValue(val)}</td>
          </tr>
        `;
      }

      html += '</tbody></table></div>';
    }

    // Subtopic count summary
    const childCount = nodeData.children ? nodeData.children.length : 0;
    html += `
      <div class="panel-footer-meta">
        <span>Subtopics: <strong>${childCount}</strong></span>
        <span>Depth: <strong>Level ${nodeData.depth || 0}</strong></span>
        <span>ID: <code>${nodeData.id}</code></span>
      </div>
    `;

    this.bodyEl.innerHTML = html;
  }

  /**
   * Reset the panel to empty state
   */
  clear() {
    this.currentNode = null;
    this.titleEl.textContent = 'No Node Selected';
    this.breadcrumbEl.innerHTML = '';
    this.breadcrumbEl.style.display = 'none';
    this.bodyEl.innerHTML = `
      <div class="panel-placeholder">
        Click any node card on the mindmap to inspect its attributes, notes, and metadata.
      </div>
    `;
  }

  toggleMinimize() {
    this.setMinimized(!this.isMinimized);
  }

  setMinimized(minimized) {
    this.isMinimized = minimized;
    if (minimized) {
      this.panel.classList.add('is-minimized');
      this.toggleBtn.innerHTML = '<span class="icon-minimize">▲</span>';
      this.toggleBtn.title = 'Expand Details Panel';
    } else {
      this.panel.classList.remove('is-minimized');
      this.toggleBtn.innerHTML = '<span class="icon-minimize">▼</span>';
      this.toggleBtn.title = 'Minimize Details Panel';
    }
  }

  formatNotes(text) {
    const escaped = this.escapeHtml(text);
    // Linkify URLs
    const linkified = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1 ↗</a>');
    // Replace newlines with breaks
    return linkified.replace(/\n/g, '<br/>');
  }

  formatValue(val) {
    if (val === null || val === undefined) return '<em class="text-muted">null</em>';
    if (typeof val === 'boolean') return `<span class="badge-boolean ${val ? 'bool-true' : 'bool-false'}">${val}</span>`;
    if (typeof val === 'object') {
      return `<code>${this.escapeHtml(JSON.stringify(val))}</code>`;
    }
    const str = String(val);
    if (/^https?:\/\//i.test(str)) {
      return `<a href="${this.escapeHtml(str)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(str)} ↗</a>`;
    }
    return this.escapeHtml(str);
  }

  slugify(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
