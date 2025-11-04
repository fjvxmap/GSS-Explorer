import { useState, useEffect } from 'react'
import './App.css'
import type { TreeNode } from './types'
import type { Graph } from './graphTypes'
import { TreeVisualization } from './TreeVisualization'
import { TimelineControl } from './TimelineControl'
import { NodeInfoPanel } from './NodeInfoPanel'
import { GraphVisualization } from './GraphVisualization'

function App() {
  const [treeData, setTreeData] = useState<TreeNode | null>(null)
  const [graphData, setGraphData] = useState<Graph | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxStep, setMaxStep] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null)
  const [solutions, setSolutions] = useState<string[]>([])
  const [hidePruned, setHidePruned] = useState(false)

  const handleFileUpload = async (csvFile: File, graphFile: File) => {
    setLoading(true)
    setError(null)

    try {
      const csvText = await csvFile.text()
      const graphText = await graphFile.text()

      const { parseCSV, buildTree } = await import('./dataLoader')
      const nodes = parseCSV(csvText)
      const treeData = buildTree(nodes)

      const lines = graphText.trim().split('\n')
      const [numNodes, numEdges] = lines[0].split(' ').map(Number)
      const edges = []
      for (let i = 1; i < lines.length; i++) {
        const [source, target] = lines[i].split(' ').map(Number)
        edges.push({ source, target })
      }
      const graphData = { numNodes, numEdges, edges }

      setTreeData(treeData)
      setGraphData(graphData)
      const maxCreationOrder = findMaxCreationOrder(treeData)
      setMaxStep(maxCreationOrder)
      setCurrentStep(50)
      setLoading(false)
    } catch (err: any) {
      console.error('Error loading files:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const findMaxCreationOrder = (node: TreeNode): number => {
    let max = node.creation_order
    if (node.children) {
      for (const child of node.children) {
        max = Math.max(max, findMaxCreationOrder(child))
      }
    }
    return max
  }

  const findSolutionsInSubtree = (node: TreeNode): string[] => {
    const solutions: string[] = []

    // If this node has cliques (is a solution node)
    if (node.cliques_in_subtree === 1 && (!node.children || node.children.length === 0)) {
      if (node.current_clique) {
        solutions.push(node.current_clique)
      }
    }

    // Recurse through children
    if (node.children) {
      for (const child of node.children) {
        solutions.push(...findSolutionsInSubtree(child))
      }
    }

    return solutions
  }

  // Find the most recent node at current step
  const findNodeAtStep = (root: TreeNode, step: number): TreeNode | null => {
    let targetNode: TreeNode | null = null;
    let maxOrder = -1;

    const traverse = (node: TreeNode) => {
      if (node.creation_order <= step && node.creation_order > maxOrder) {
        maxOrder = node.creation_order;
        targetNode = node;
      }
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(root);
    return targetNode;
  };

  const handleNodeClick = (node: TreeNode) => {
    setSelectedNode(node)
    const sols = findSolutionsInSubtree(node)
    setSolutions(sols)
  }

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying)
    if (currentStep >= maxStep) {
      setCurrentStep(0)
    }
  }

  // Auto-select most recent node when step changes
  useEffect(() => {
    if (treeData) {
      const currentNode = findNodeAtStep(treeData, currentStep);
      if (currentNode) {
        setSelectedNode(currentNode);
        const sols = findSolutionsInSubtree(currentNode);
        setSolutions(sols);
      }
    }
  }, [currentStep, treeData]);

  const handleStepChange = (step: number) => {
    setCurrentStep(step)
    if (step >= maxStep) {
      setIsPlaying(false)
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading tree data...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '10px'
      }}>
        <div style={{ color: '#e74c3c', fontSize: '18px' }}>Error loading data</div>
        <div style={{ fontSize: '14px' }}>{error}</div>
      </div>
    )
  }

  if (!treeData) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '20px',
        padding: '20px'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>GSS-Explorer</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '14px', textAlign: 'center', maxWidth: '500px' }}>
          Interactive Visualization for Analyzing Backtracking Search Spaces in Graph Algorithms
        </p>

        <div style={{
          background: '#f5f5f5',
          padding: '30px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          minWidth: '400px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Upload Files</h3>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
              Tree CSV File:
            </label>
            <input
              type="file"
              accept=".csv"
              id="csvFile"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
              Graph Edge List File:
            </label>
            <input
              type="file"
              accept=".txt,.graph"
              id="graphFile"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '13px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={() => {
              const csvInput = document.getElementById('csvFile') as HTMLInputElement;
              const graphInput = document.getElementById('graphFile') as HTMLInputElement;

              if (csvInput.files?.[0] && graphInput.files?.[0]) {
                handleFileUpload(csvInput.files[0], graphInput.files[0]);
              } else {
                setError('Please select both CSV and graph files');
              }
            }}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#2980b9'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#3498db'}
          >
            Load Files
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: '15px',
      boxSizing: 'border-box'
    }}>
      <header style={{ marginBottom: '12px', flexShrink: 0 }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>GSS-Explorer</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '13px' }}>
          Interactive Visualization for Analyzing Backtracking Search Spaces in Graph Algorithms
        </p>
      </header>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '15px',
        flex: 1,
        minHeight: 0,
        marginBottom: '10px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: 0
        }}>
          <div style={{ flexShrink: 0 }}>
            <TimelineControl
              maxStep={maxStep}
              currentStep={currentStep}
              onStepChange={handleStepChange}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
            />
          </div>

          <div style={{
            padding: '10px',
            background: '#f5f5f5',
            borderRadius: '8px',
            flexShrink: 0
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              fontSize: '13px'
            }}>
              <input
                type="checkbox"
                checked={hidePruned}
                onChange={(e) => setHidePruned(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span>Hide Pruned Nodes (Show only non-pivot path)</span>
            </label>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <TreeVisualization
              data={treeData}
              maxStep={maxStep}
              currentStep={currentStep}
              onNodeClick={handleNodeClick}
              hidePruned={hidePruned}
            />
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          minHeight: 0,
          height: '100%',
          overflow: 'hidden'
        }}>
          {graphData && (
            <div style={{ height: 'calc(45% - 7.5px)', flexShrink: 0 }}>
              <GraphVisualization
                graph={graphData}
                currentNode={selectedNode}
              />
            </div>
          )}
          <div style={{ height: 'calc(55% - 7.5px)', flexShrink: 0, overflow: 'hidden' }}>
            <NodeInfoPanel node={selectedNode} solutions={solutions} />
          </div>
        </div>
      </div>

      <div style={{
        background: '#f5f5f5',
        padding: '10px',
        borderRadius: '8px',
        fontSize: '12px',
        flexShrink: 0
      }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Legend</h4>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#3498db'
            }} />
            <span>Depth 0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#2ecc71'
            }} />
            <span>Depth 1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#e74c3c'
            }} />
            <span>Pruned by Pivot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Node size = cliques in subtree</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
