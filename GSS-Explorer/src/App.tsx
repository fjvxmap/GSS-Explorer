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
  const [showLowPruningBorder, setShowLowPruningBorder] = useState(true)
  const [showOnlyLowPruning, setShowOnlyLowPruning] = useState(false)
  const [lowPruningThreshold, setLowPruningThreshold] = useState(30)

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
        gap: '12px',
        padding: '10px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>GSS-Explorer</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '12px', textAlign: 'center', maxWidth: '450px', lineHeight: '1.3' }}>
          Interactive Visualization for Analyzing Backtracking Search Spaces in Graph Algorithms
        </p>

        <div style={{
          background: '#f5f5f5',
          padding: '15px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minWidth: '350px',
          maxWidth: '90vw'
        }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>Upload Files</h3>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              Tree CSV File:
            </label>
            <input
              type="file"
              accept=".csv"
              id="csvFile"
              style={{
                width: '100%',
                padding: '6px',
                fontSize: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              Graph Edge List File:
            </label>
            <input
              type="file"
              accept=".txt,.graph"
              id="graphFile"
              style={{
                width: '100%',
                padding: '6px',
                fontSize: '12px',
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
              padding: '8px 16px',
              fontSize: '12px',
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
      padding: '4px',
      boxSizing: 'border-box'
    }}>
      <header style={{ marginBottom: '5px', flexShrink: 0 }}>
        <h1 style={{ margin: '0 0 2px 0', fontSize: '20px', lineHeight: '1.2' }}>GSS-Explorer</h1>
        <p style={{ margin: 0, color: '#666', fontSize: '12px', lineHeight: '1.2' }}>
          Interactive Visualization for Analyzing Backtracking Search Spaces in Graph Algorithms
        </p>
      </header>

      {/* Main Content Area - Radial Tree (Left, Full Column) + Controls/Graph/Info (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 360px',
        gap: '6px',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Left: Radial Tree Visualization - Main Figure (Full Column) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <TreeVisualization
            data={treeData}
            maxStep={maxStep}
            currentStep={currentStep}
            onNodeClick={handleNodeClick}
            hidePruned={hidePruned}
            showLowPruningBorder={showLowPruningBorder}
            showOnlyLowPruning={showOnlyLowPruning}
            lowPruningThreshold={lowPruningThreshold}
            graph={graphData}
          />
        </div>

        {/* Right: Controls (Top, Vertical) + Input Graph (Middle) + Node Info (Bottom) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          minHeight: 0,
          height: '100%',
          overflow: 'hidden'
        }}>
          {/* Compact Controls Column (Vertical) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            flexShrink: 0
          }}>
            {/* Timeline Control */}
            <TimelineControl
              maxStep={maxStep}
              currentStep={currentStep}
              onStepChange={handleStepChange}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
            />
            {/* Pruning Options */}
            <div style={{
              padding: '6px 8px',
              background: '#f5f5f5',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}>
                <input
                  type="checkbox"
                  checked={hidePruned}
                  onChange={(e) => setHidePruned(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Hide Pruned Nodes (Show only non-pivot path)</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}>
                <input
                  type="checkbox"
                  checked={showLowPruningBorder}
                  onChange={(e) => setShowLowPruningBorder(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Show Low Pruning Border</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px'
              }}>
                <input
                  type="checkbox"
                  checked={showOnlyLowPruning}
                  onChange={(e) => setShowOnlyLowPruning(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Show Only Low Pruning Nodes</span>
              </label>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '3px' }}>
                  Low Pruning Threshold: &lt;{lowPruningThreshold}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={lowPruningThreshold}
                  onChange={(e) => setLowPruningThreshold(Number(e.target.value))}
                  style={{ width: '100%', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Input Graph */}
          {graphData && (
            <div style={{ 
              flex: '1 1 35%',
              minHeight: 0,
              overflow: 'hidden'
            }}>
              <GraphVisualization
                graph={graphData}
                currentNode={selectedNode}
              />
            </div>
          )}
          {/* Node Info Panel */}
          <div style={{ 
            flex: '1 1 35%',
            minHeight: 0,
            overflow: 'hidden'
          }}>
            <NodeInfoPanel node={selectedNode} solutions={solutions} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
