/**
 * parser.js - Flexible JSON and YAML Mindmap Normalizer
 * Normalizes varied hierarchical mindmap conventions into a canonical tree structure:
 * { id, label, children, attributes, raw }
 */

export class MindmapParser {
  static LABEL_KEYS = ['label', 'name', 'title', 'topic', 'text', 'id'];
  static CHILDREN_KEYS = ['children', 'nodes', 'subtopics', 'items', 'branches'];

  /**
   * Parse raw text (JSON or YAML) and normalize into a tree hierarchy.
   * @param {string} text - The raw file content
   * @param {string} [filename=''] - Optional filename to assist format detection
   * @returns {{ root: object, nodeCount: number, format: 'json'|'yaml' }}
   */
  static parse(text, filename = '') {
    if (!text || typeof text !== 'string' || !text.trim()) {
      throw new Error('File content is empty.');
    }

    const trimmed = text.trim();
    let rawData = null;
    let format = 'json';

    const isExplicitYaml = /\.ya?ml$/i.test(filename);
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

    const yamlLib = typeof window !== 'undefined' ? (window.jsyaml || globalThis.jsyaml) : (globalThis.jsyaml || null);

    if (isExplicitYaml || (!looksLikeJson && yamlLib)) {
      try {
        if (!yamlLib) {
          throw new Error('YAML parser library (js-yaml) is not loaded.');
        }
        rawData = yamlLib.load(text);
        format = 'yaml';
      } catch (yamlErr) {
        // If it was explicitly YAML, throw YAML error
        if (isExplicitYaml) {
          throw new Error(`YAML Parse Error: ${yamlErr.message || yamlErr}`);
        }
        // Otherwise attempt JSON parse fallback
        try {
          rawData = JSON.parse(text);
          format = 'json';
        } catch {
          throw new Error(`Failed to parse as YAML or JSON: ${yamlErr.message || yamlErr}`);
        }
      }
    } else {
      // Try JSON first
      try {
        rawData = JSON.parse(text);
        format = 'json';
      } catch (jsonErr) {
        // Fallback to YAML if available
        if (yamlLib) {
          try {
            rawData = yamlLib.load(text);
            format = 'yaml';
          } catch (yamlErr) {
            throw new Error(`JSON Parse Error: ${jsonErr.message} (YAML fallback also failed: ${yamlErr.message})`);
          }
        } else {
          throw new Error(`JSON Parse Error: ${jsonErr.message}`);
        }
      }
    }

    if (!rawData || typeof rawData !== 'object') {
      throw new Error('Invalid mindmap data: Root must be a structured JSON/YAML object.');
    }

    // Unwrap common wrapper keys: { mindmap: { ... } }, { root: { ... } }, { map: { ... } }
    let rootObject = rawData;
    if (Array.isArray(rootObject)) {
      if (rootObject.length === 1 && typeof rootObject[0] === 'object') {
        rootObject = rootObject[0];
      } else {
        rootObject = {
          name: 'Mindmap',
          children: rootObject
        };
      }
    } else {
      const wrapperKeys = ['mindmap', 'root', 'map', 'data'];
      for (const key of wrapperKeys) {
        if (
          rootObject[key] &&
          typeof rootObject[key] === 'object' &&
          !Array.isArray(rootObject[key]) &&
          Object.keys(rootObject).length === 1
        ) {
          rootObject = rootObject[key];
          break;
        }
      }
    }

    let nodeCounter = 0;

    /**
     * Recursive normalizer
     */
    function normalizeNode(rawNode, depth = 0, path = []) {
      if (typeof rawNode === 'string' || typeof rawNode === 'number') {
        nodeCounter++;
        const currentPath = [...path, String(rawNode)];
        return {
          id: `node_${nodeCounter}`,
          label: String(rawNode),
          children: [],
          attributes: {},
          depth,
          path: currentPath,
          raw: { value: rawNode }
        };
      }

      if (!rawNode || typeof rawNode !== 'object') {
        return null;
      }

      nodeCounter++;
      const currentId = `node_${nodeCounter}`;

      // Resolve Label
      let resolvedLabel = '';
      let usedLabelKey = null;

      for (const key of MindmapParser.LABEL_KEYS) {
        if (rawNode[key] !== undefined && rawNode[key] !== null && String(rawNode[key]).trim()) {
          resolvedLabel = String(rawNode[key]).trim();
          usedLabelKey = key;
          break;
        }
      }

      if (!resolvedLabel) {
        resolvedLabel = depth === 0 ? 'Central Topic' : `Node ${nodeCounter}`;
      }

      const currentPath = [...path, resolvedLabel];

      // Resolve Children
      let rawChildren = [];
      let usedChildrenKey = null;

      for (const key of MindmapParser.CHILDREN_KEYS) {
        if (Array.isArray(rawNode[key])) {
          rawChildren = rawNode[key];
          usedChildrenKey = key;
          break;
        }
      }

      // Extract custom attributes (all properties except resolved label key and children key)
      const attributes = {};
      for (const [key, val] of Object.entries(rawNode)) {
        if (key === usedLabelKey || key === usedChildrenKey) continue;
        // Also exclude other label/children keys if they are redundant or duplicate
        if (MindmapParser.CHILDREN_KEYS.includes(key) && Array.isArray(val)) continue;
        attributes[key] = val;
      }

      // Recursively normalize children
      const children = [];
      for (const childRaw of rawChildren) {
        const normalizedChild = normalizeNode(childRaw, depth + 1, currentPath);
        if (normalizedChild) {
          children.push(normalizedChild);
        }
      }

      return {
        id: currentId,
        label: resolvedLabel,
        children,
        attributes,
        depth,
        path: currentPath,
        raw: rawNode
      };
    }

    const normalizedRoot = normalizeNode(rootObject, 0, []);
    if (!normalizedRoot) {
      throw new Error('Unable to construct a valid mindmap tree from the provided file.');
    }

    return {
      root: normalizedRoot,
      nodeCount: nodeCounter,
      format
    };
  }
}
