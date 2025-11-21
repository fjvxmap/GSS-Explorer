export type TreeNode = {
  node_id: number;
  parent_id: number;
  children_ids: number[];
  cliques_in_subtree: number;
  creation_order: number;
  depth: number;
  candidate_vertex: number;
  current_clique: string;
  x_set: string;
  p_set: string;
  pruned_by_pivot: boolean;
  children?: TreeNode[];
}
