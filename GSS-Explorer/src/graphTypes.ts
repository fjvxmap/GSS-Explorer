export type GraphEdge = {
  source: number;
  target: number;
};

export type Graph = {
  numNodes: number;
  numEdges: number;
  edges: GraphEdge[];
};

export type VertexState = 'current_clique' | 'P' | 'X' | 'normal';
