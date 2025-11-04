import type { Graph, GraphEdge } from './graphTypes';

export async function loadGraph(path: string): Promise<Graph> {
  const response = await fetch(path);
  const text = await response.text();
  const lines = text.trim().split('\n');

  // First line: numNodes numEdges
  const [numNodes, numEdges] = lines[0].split(' ').map(Number);

  const edges: GraphEdge[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [source, target] = lines[i].split(' ').map(Number);
    edges.push({ source, target });
  }

  return { numNodes, numEdges, edges };
}
