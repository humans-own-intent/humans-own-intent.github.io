/**
 * mindmap.js - D3.js Horizontal Hierarchical Tree Renderer
 * Handles SVG rendering, collapsible branches, smooth pan & zoom, selection, and transitions.
 */

export class MindmapRenderer {
  constructor(containerElement, options = {}) {
    this.container = typeof containerElement === 'string'
      ? document.querySelector(containerElement)
      : containerElement;

    if (!this.container) {
      throw new Error('MindmapRenderer container element not found.');
    }

    this.onNodeSelected = options.onNodeSelected || (() => {});
    this.onBranchToggled = options.onBranchToggled || (() => {});

    this.selectedNodeId = null;
    this.highlightedNodeIds = new Set();
    this.rootNode = null;
    this.d3Root = null;

    // Node card layout dimensions
    this.cardWidth = 200;
    this.cardHeight = 48;
    this.levelSpacing = 280;
    this.nodeVerticalSpacing = 64;

    this.initSvg();
  }

  initSvg() {
    this.container.innerHTML = '';

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'mindmap-svg')
      .attr('width', '100%')
      .attr('height', '100%');

    // Create defs for dropshadow and gradients
    const defs = this.svg.append('defs');

    const filter = defs.append('filter')
      .attr('id', 'card-shadow')
      .attr('x', '-10%')
      .attr('y', '-20%')
      .attr('width', '130%')
      .attr('height', '150%');

    filter.append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '3')
      .attr('stdDeviation', '4')
      .attr('flood-color', 'rgba(0, 0, 0, 0.12)');

    // Main zoom container group
    this.gMain = this.svg.append('g').attr('class', 'mindmap-canvas');
    this.gLinks = this.gMain.append('g').attr('class', 'mindmap-links');
    this.gNodes = this.gMain.append('g').attr('class', 'mindmap-nodes');

    // Zoom behavior
    this.zoom = d3.zoom()
      .scaleExtent([0.15, 3.0])
      .on('zoom', (event) => {
        this.gMain.attr('transform', event.transform);
      });

    this.svg.call(this.zoom);

    // Double-click zoom disable so double-click can be used without jarring zoom
    this.svg.on('dblclick.zoom', null);

    window.addEventListener('resize', () => {
      // Keep canvas dimensions responsive
    });
  }

  /**
   * Set and render new mindmap hierarchy data
   * @param {object} normalizedData - Root node produced by MindmapParser
   */
  setData(normalizedData) {
    this.rootNode = normalizedData;
    this.selectedNodeId = null;
    this.highlightedNodeIds.clear();

    // Construct D3 hierarchy
    this.d3Root = d3.hierarchy(this.rootNode, d => d.children);
    this.d3Root.x0 = (this.container.clientHeight || 600) / 2;
    this.d3Root.y0 = 60;

    // Default collapse: expand root (depth 0) and direct children (depth 1), collapse deeper
    this.d3Root.descendants().forEach(d => {
      if (d.depth >= 1 && d.children && d.children.length > 0) {
        d._children = d.children;
        d.children = null;
      }
    });

    this.update(this.d3Root, true);

    // Initial fit view
    setTimeout(() => {
      this.fitView(400);
    }, 50);
  }

  /**
   * Update tree layout and transitions
   * @param {object} source - Origin node for animation transitions
   * @param {boolean} isInitial - Whether this is the first layout render
   */
  update(source = this.d3Root, isInitial = false) {
    if (!this.d3Root) return;

    const duration = isInitial ? 0 : 350;

    // Create D3 tree layout with node separation
    const treeLayout = d3.tree()
      .nodeSize([this.nodeVerticalSpacing, this.levelSpacing])
      .separation((a, b) => (a.parent === b.parent ? 1.15 : 1.35));

    treeLayout(this.d3Root);

    const nodes = this.d3Root.descendants();
    const links = this.d3Root.links();

    // Normalize horizontal coordinate by depth
    nodes.forEach(d => {
      d.y = d.depth * this.levelSpacing + 60;
    });

    // -------------------------------------------------------------
    // LINKS
    // -------------------------------------------------------------
    const linkGenerator = d3.linkHorizontal()
      .x(d => d.y)
      .y(d => d.x);

    const link = this.gLinks.selectAll('path.mindmap-link')
      .data(links, d => d.target.data.id);

    // Enter new links
    const linkEnter = link.enter().append('path')
      .attr('class', d => `mindmap-link depth-${d.source.depth}`)
      .attr('d', () => {
        const o = { x: source.x0 !== undefined ? source.x0 : source.x, y: source.y0 !== undefined ? source.y0 : source.y };
        return linkGenerator({ source: o, target: o });
      });

    // Merge & transition links
    link.merge(linkEnter).transition().duration(duration)
      .attr('class', d => {
        const isPathHighlighted = this.highlightedNodeIds.has(d.target.data.id);
        return `mindmap-link depth-${d.source.depth} ${isPathHighlighted ? 'highlighted' : ''}`;
      })
      .attr('d', linkGenerator);

    // Exit links
    link.exit().transition().duration(duration)
      .attr('d', () => {
        const o = { x: source.x, y: source.y };
        return linkGenerator({ source: o, target: o });
      })
      .remove();

    // -------------------------------------------------------------
    // NODES
    // -------------------------------------------------------------
    const node = this.gNodes.selectAll('g.mindmap-node')
      .data(nodes, d => d.data.id);

    // Enter new nodes
    const nodeEnter = node.enter().append('g')
      .attr('class', d => `mindmap-node depth-${d.depth} ${d.depth === 0 ? 'root-node' : ''}`)
      .attr('transform', () => {
        const px = source.x0 !== undefined ? source.x0 : source.x;
        const py = source.y0 !== undefined ? source.y0 : source.y;
        return `translate(${py},${px})`;
      });

    // Node Card Rectangle
    nodeEnter.append('rect')
      .attr('class', 'node-card')
      .attr('x', 0)
      .attr('y', -this.cardHeight / 2)
      .attr('width', this.cardWidth)
      .attr('height', this.cardHeight)
      .attr('rx', 8)
      .attr('ry', 8)
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectNode(d.data.id);
      });

    // Node Status Dot if status attribute present
    nodeEnter.append('circle')
      .attr('class', 'node-status-dot')
      .attr('cx', 12)
      .attr('cy', 0)
      .attr('r', 4)
      .style('display', d => (d.data.attributes && d.data.attributes.status ? 'inline' : 'none'));

    // Node Label Text
    nodeEnter.append('text')
      .attr('class', 'node-label')
      .attr('x', d => (d.data.attributes && d.data.attributes.status ? 24 : 14))
      .attr('y', 0)
      .attr('dy', '0.35em')
      .text(d => this.truncateText(d.data.label, 20))
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectNode(d.data.id);
      })
      .append('title')
      .text(d => d.data.label);

    // Collapse / Expand Pill Badge (for nodes with children or hidden children)
    const badgeGroup = nodeEnter.append('g')
      .attr('class', 'node-badge')
      .attr('transform', `translate(${this.cardWidth - 28}, 0)`)
      .on('click', (event, d) => {
        event.stopPropagation();
        this.toggleBranch(d);
      });

    badgeGroup.append('rect')
      .attr('class', 'badge-bg')
      .attr('x', -6)
      .attr('y', -10)
      .attr('width', 28)
      .attr('height', 20)
      .attr('rx', 10)
      .attr('ry', 10);

    badgeGroup.append('text')
      .attr('class', 'badge-text')
      .attr('x', 8)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle');

    // Merge and update existing + entered nodes
    const nodeUpdate = node.merge(nodeEnter);

    nodeUpdate.transition().duration(duration)
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('class', d => {
        const isSelected = d.data.id === this.selectedNodeId;
        const isHighlighted = this.highlightedNodeIds.has(d.data.id);
        const hasDim = this.highlightedNodeIds.size > 0 && !isHighlighted;
        return [
          'mindmap-node',
          `depth-${d.depth}`,
          d.depth === 0 ? 'root-node' : '',
          d._children ? 'is-collapsed' : '',
          isSelected ? 'is-selected' : '',
          isHighlighted ? 'is-highlighted' : '',
          hasDim ? 'is-dimmed' : ''
        ].filter(Boolean).join(' ');
      });

    // Update badge display and text
    nodeUpdate.each(function(d) {
      const g = d3.select(this);
      const badge = g.select('.node-badge');
      const hasChildren = (d.children && d.children.length > 0) || (d._children && d._children.length > 0);

      if (!hasChildren) {
        badge.style('display', 'none');
      } else {
        badge.style('display', 'inline');
        const count = d._children ? d._children.length : (d.children ? d.children.length : 0);
        const isCollapsed = Boolean(d._children);

        badge.select('.badge-text')
          .text(isCollapsed ? `+${count}` : '−');

        badge.select('.badge-bg')
          .attr('class', `badge-bg ${isCollapsed ? 'badge-collapsed' : 'badge-expanded'}`);
      }

      // Update status dot color class
      const statusDot = g.select('.node-status-dot');
      if (d.data.attributes && d.data.attributes.status) {
        statusDot.style('display', 'inline')
          .attr('class', `node-status-dot status-${String(d.data.attributes.status).toLowerCase().replace(/\s+/g, '-')}`);
      } else {
        statusDot.style('display', 'none');
      }
    });

    // Exit old nodes
    const nodeExit = node.exit().transition().duration(duration)
      .attr('transform', () => `translate(${source.y},${source.x})`)
      .remove();

    nodeExit.select('rect').attr('width', 0);
    nodeExit.select('text').style('fill-opacity', 0);

    // Stash positions for smooth next transition
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  /**
   * Toggle branch collapse/expand
   */
  toggleBranch(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
    } else {
      return;
    }

    this.update(d);
    this.onBranchToggled(d.data, Boolean(d.children));
  }

  /**
   * Select a node by ID and trigger callback
   */
  selectNode(nodeId) {
    this.selectedNodeId = nodeId;

    let targetNodeData = null;
    if (this.d3Root) {
      const found = this.d3Root.descendants().find(d => d.data.id === nodeId);
      if (found) {
        targetNodeData = found.data;
      }
    }

    this.update(this.d3Root);

    if (targetNodeData) {
      this.onNodeSelected(targetNodeData);
    }
  }

  /**
   * Expand all ancestor nodes leading to a target node
   * @param {string} targetNodeId
   */
  expandAncestors(targetNodeId) {
    if (!this.d3Root) return;

    let target = null;
    // Helper to search descendants and hidden children
    function findNodeRecursive(d) {
      if (d.data && d.data.id === targetNodeId) return d;
      const allKids = (d.children || []).concat(d._children || []);
      for (const kid of allKids) {
        const res = findNodeRecursive(kid);
        if (res) return res;
      }
      return null;
    }

    target = findNodeRecursive(this.d3Root);
    if (!target) return;

    // Traverse up ancestors and expand any that are collapsed
    let curr = target.parent;
    let didExpand = false;
    while (curr) {
      if (curr._children) {
        curr.children = curr._children;
        curr._children = null;
        didExpand = true;
      }
      curr = curr.parent;
    }

    if (didExpand) {
      this.update(this.d3Root);
    }
  }

  /**
   * Expand all nodes across the entire tree
   */
  expandAll() {
    if (!this.d3Root) return;

    function expand(d) {
      if (d._children) {
        d.children = d._children;
        d._children = null;
      }
      if (d.children) {
        d.children.forEach(expand);
      }
    }

    expand(this.d3Root);
    this.update(this.d3Root);
    this.fitView(400);
  }

  /**
   * Collapse all nodes beyond root
   */
  collapseAll() {
    if (!this.d3Root) return;

    function collapse(d) {
      if (d.children) {
        d.children.forEach(collapse);
        if (d.depth > 0) {
          d._children = d.children;
          d.children = null;
        }
      }
    }

    collapse(this.d3Root);
    this.update(this.d3Root);
    this.fitView(400);
  }

  /**
   * Highlight matching nodes and dim non-matching
   */
  setHighlights(nodeIdSet) {
    this.highlightedNodeIds = new Set(nodeIdSet);
    this.update(this.d3Root);
  }

  clearHighlights() {
    this.highlightedNodeIds.clear();
    this.update(this.d3Root);
  }

  /**
   * Zoom In by fixed factor
   */
  zoomIn() {
    this.svg.transition().duration(250).call(this.zoom.scaleBy, 1.3);
  }

  /**
   * Zoom Out by fixed factor
   */
  zoomOut() {
    this.svg.transition().duration(250).call(this.zoom.scaleBy, 0.77);
  }

  /**
   * Fit view to center and frame the current tree
   */
  fitView(duration = 400) {
    if (!this.gNodes || this.gNodes.empty()) return;

    const nodeGroup = this.gMain.node();
    const bounds = nodeGroup.getBBox();

    if (!bounds || bounds.width === 0 || bounds.height === 0) return;

    const containerWidth = this.container.clientWidth || 800;
    const containerHeight = this.container.clientHeight || 600;

    const padding = 60;
    const fullWidth = bounds.width + padding * 2;
    const fullHeight = bounds.height + padding * 2;

    const midX = bounds.x + bounds.width / 2;
    const midY = bounds.y + bounds.height / 2;

    const scale = Math.max(0.2, Math.min(1.4, Math.min(containerWidth / fullWidth, containerHeight / fullHeight)));
    const translateX = containerWidth / 2 - scale * midX;
    const translateY = containerHeight / 2 - scale * midY;

    const transform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    this.svg.transition()
      .duration(duration)
      .call(this.zoom.transform, transform);
  }

  truncateText(text, maxChars = 22) {
    if (!text) return '';
    return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
  }
}
