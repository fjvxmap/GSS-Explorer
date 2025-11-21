import { useState } from 'react';
import type { TreeNode } from './types';

interface NodeInfoPanelProps {
  node: TreeNode | null;
  solutions: string[];
}

export function NodeInfoPanel({ node, solutions }: NodeInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'solutions'>('info');

  if (!node) {
    return (
      <div style={{
        padding: '6px',
        background: '#f5f5f5',
        borderRadius: '6px',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ fontSize: '11px', marginTop: 0, marginBottom: '3px' }}>Node Information</h3>
        <p style={{ color: '#666', fontSize: '9px', margin: 0 }}>Click on a node to see details</p>
      </div>
    );
  }

  return (
      <div style={{
        padding: '6px',
        background: '#f5f5f5',
        borderRadius: '6px',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
      {/* Toggle Tabs */}
      <div style={{
        display: 'flex',
        gap: '3px',
        marginBottom: '5px',
        flexShrink: 0,
        borderBottom: '1px solid #ddd'
      }}>
        <button
          onClick={() => setActiveTab('info')}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'info' ? '#3498db' : 'transparent',
            color: activeTab === 'info' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'info' ? '2px solid #3498db' : '2px solid transparent',
            borderRadius: '4px 4px 0 0',
            marginBottom: '-1px'
          }}
        >
          Node Info
        </button>
        <button
          onClick={() => setActiveTab('solutions')}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'solutions' ? '#3498db' : 'transparent',
            color: activeTab === 'solutions' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'solutions' ? '2px solid #3498db' : '2px solid transparent',
            borderRadius: '4px 4px 0 0',
            marginBottom: '-1px',
            position: 'relative'
          }}
        >
          Solutions ({solutions.length})
        </button>
      </div>

      {/* Content based on active tab */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'info' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '5px 8px',
            fontSize: '12px',
            lineHeight: '1.4',
            flex: 1,
            overflowY: 'auto',
            paddingRight: '4px',
            alignContent: 'center',
            justifyItems: 'start'
          }}>
            <strong>Node ID:</strong>
            <span>{node.node_id}</span>

            <strong>Depth:</strong>
            <span>{node.depth}</span>

            <strong>Creation Order:</strong>
            <span>{node.creation_order}</span>

            <strong>Current Clique:</strong>
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{node.current_clique || 'empty'}</span>

            <strong>Cliques in Subtree:</strong>
            <span>{node.cliques_in_subtree}</span>

            <strong>Candidate Vertex:</strong>
            <span>{node.candidate_vertex}</span>

            <strong>X Set:</strong>
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{node.x_set || 'empty'}</span>

            <strong>P Set:</strong>
            <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{node.p_set || 'empty'}</span>

            <strong>Pruned by Pivot:</strong>
            <span style={{
              color: node.pruned_by_pivot ? '#e74c3c' : '#2ecc71',
              fontWeight: 'bold'
            }}>
              {node.pruned_by_pivot ? 'Yes' : 'No'}
            </span>
          </div>
        ) : (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            fontSize: '11px',
            fontFamily: 'monospace',
            background: 'white',
            padding: '8px',
            borderRadius: '4px',
            minHeight: 0,
            lineHeight: '1.4'
          }}>
            {solutions.length > 0 ? (
              solutions.map((sol, idx) => (
                <div key={idx} style={{ marginBottom: '2px' }}>
                  {sol}
                </div>
              ))
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>No solutions found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
