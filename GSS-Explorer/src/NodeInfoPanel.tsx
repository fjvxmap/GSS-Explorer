import type { TreeNode } from './types';

interface NodeInfoPanelProps {
  node: TreeNode | null;
  solutions: string[];
}

export function NodeInfoPanel({ node, solutions }: NodeInfoPanelProps) {
  if (!node) {
    return (
      <div
        style={{
          padding: '15px',
          background: '#f5f5f5',
          borderRadius: '8px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ fontSize: '16px', marginTop: 0 }}>Node Information</h3>
        <p style={{ color: '#666', fontSize: '13px' }}>
          Click on a node to see details
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '15px',
        background: '#f5f5f5',
        borderRadius: '8px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
    >
      <h3
        style={{
          marginTop: 0,
          fontSize: '16px',
          marginBottom: '10px',
          flexShrink: 0,
        }}
      >
        Node Information
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '130px 1fr',
          gap: '6px',
          fontSize: '12px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        <strong>Node ID:</strong>
        <span>{node.node_id}</span>

        <strong>Depth:</strong>
        <span>{node.depth}</span>

        <strong>Creation Order:</strong>
        <span>{node.creation_order}</span>

        <strong>Current Clique:</strong>
        <span style={{ fontFamily: 'monospace' }}>
          {node.current_clique || 'empty'}
        </span>

        <strong>Cliques in Subtree:</strong>
        <span>{node.cliques_in_subtree}</span>

        <strong>Candidate Vertex:</strong>
        <span>{node.candidate_vertex}</span>

        <strong>X Size:</strong>
        <span>{node.x_size}</span>

        <strong>P Size:</strong>
        <span>{node.p_size}</span>

        <strong>Pruned by Pivot:</strong>
        <span
          style={{
            color: node.pruned_by_pivot ? '#e74c3c' : '#2ecc71',
            fontWeight: 'bold',
          }}
        >
          {node.pruned_by_pivot ? 'Yes' : 'No'}
        </span>
      </div>

      {solutions.length > 0 && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h4 style={{ marginBottom: '6px', fontSize: '14px', flexShrink: 0 }}>
            Solutions Found ({solutions.length}):
          </h4>
          <div
            style={{
              flex: 1,
              fontSize: '11px',
              fontFamily: 'monospace',
              background: 'white',
              padding: '8px',
              borderRadius: '4px',
            }}
          >
            {solutions.map((sol, idx) => (
              <div key={idx} style={{ marginBottom: '3px' }}>
                {sol}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
