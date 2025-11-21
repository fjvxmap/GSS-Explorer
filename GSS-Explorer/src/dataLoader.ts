import type { TreeNode } from './types';

export function parseCSV(csvText: string): TreeNode[] {
  const lines = csvText.trim().split('\n');
  const nodes: TreeNode[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',');

    const node: TreeNode = {
      node_id: parseInt(values[0]),
      parent_id: parseInt(values[1]),
      children_ids: values[2] ? values[2].replace(/"/g, '').split(';').filter(s => s).map(Number) : [],
      cliques_in_subtree: parseInt(values[3]),
      creation_order: parseInt(values[4]),
      depth: parseInt(values[5]),
      candidate_vertex: parseInt(values[6]),
      current_clique: values[7].replace(/"/g, ''),
      x_set: values[8].replace(/"/g, ''),
      p_set: values[9].replace(/"/g, ''),
      pruned_by_pivot: values[10] === 'true'
    };

    nodes.push(node);
  }

  return nodes;
}

export function buildTree(nodes: TreeNode[]): TreeNode {
  const nodeMap = new Map<number, TreeNode>();

  // Create a map of all nodes
  nodes.forEach(node => {
    nodeMap.set(node.node_id, { ...node, children: [] });
  });

  let root: TreeNode | null = null;

  // Build parent-child relationships
  nodes.forEach(node => {
    const currentNode = nodeMap.get(node.node_id)!;

    // Root node has parent_id of -2
    if (node.parent_id === -2) {
      root = currentNode;
    } else {
      // Find parent and add current node as child
      const parent = nodeMap.get(node.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(currentNode);
      }
    }
  });

  if (!root) {
    throw new Error('Root node not found');
  }

  console.log('Built tree, root:', root);

  return root;
}

export async function loadTreeData(csvPath: string): Promise<TreeNode> {
  const response = await fetch(csvPath);
  const csvText = await response.text();
  const nodes = parseCSV(csvText);
  return buildTree(nodes);
}
