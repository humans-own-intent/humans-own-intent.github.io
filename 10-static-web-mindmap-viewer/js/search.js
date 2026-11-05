/**
 * search.js - Mindmap Search Indexing & Ancestor Path Expansion
 * Indexes node labels, notes, tags, and attributes for real-time querying.
 */

export class MindmapSearch {
  constructor(renderer) {
    this.renderer = renderer;
    this.index = [];
  }

  /**
   * Build a searchable index from the normalized root node
   * @param {object} rootNode
   */
  buildIndex(rootNode) {
    this.index = [];
    if (!rootNode) return;

    const traverse = (node) => {
      if (!node) return;

      const searchableParts = [];

      // Label
      if (node.label) searchableParts.push(String(node.label));

      // Attributes
      if (node.attributes) {
        for (const [key, val] of Object.entries(node.attributes)) {
          if (val === null || val === undefined) continue;
          if (Array.isArray(val)) {
            searchableParts.push(val.join(' '));
          } else if (typeof val === 'object') {
            searchableParts.push(JSON.stringify(val));
          } else {
            searchableParts.push(`${key}: ${String(val)}`);
            searchableParts.push(String(val));
          }
        }
      }

      this.index.push({
        id: node.id,
        label: node.label,
        searchText: searchableParts.join(' ').toLowerCase(),
        node
      });

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    traverse(rootNode);
  }

  /**
   * Execute a search query
   * @param {string} query
   * @returns {{ matchCount: number, matchingIds: string[] }}
   */
  search(query) {
    const trimmed = (query || '').trim().toLowerCase();

    if (!trimmed) {
      this.clear();
      return { matchCount: 0, matchingIds: [] };
    }

    const matchingIds = [];

    for (const item of this.index) {
      if (item.searchText.includes(trimmed)) {
        matchingIds.push(item.id);
      }
    }

    // Auto-expand all collapsed ancestor branches for matches
    for (const matchId of matchingIds) {
      this.renderer.expandAncestors(matchId);
    }

    // Apply highlights to matching nodes and dim non-matching
    this.renderer.setHighlights(matchingIds);

    return {
      matchCount: matchingIds.length,
      matchingIds
    };
  }

  /**
   * Clear active search highlights
   */
  clear() {
    this.renderer.clearHighlights();
  }
}
