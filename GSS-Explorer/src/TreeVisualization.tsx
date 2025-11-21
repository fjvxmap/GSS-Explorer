import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { TreeNode } from './types';
import type { Graph } from './graphTypes';
import { SubgraphTooltip } from './SubgraphTooltip';

interface TreeVisualizationProps {
  data: TreeNode;
  maxStep: number;
  currentStep: number;
  onNodeClick?: (node: TreeNode) => void;
  hidePruned: boolean;
  showLowPruningBorder: boolean;
  graph?: Graph | null;
  showOnlyLowPruning: boolean;
  lowPruningThreshold: number;
}

export function TreeVisualization({ data, maxStep, currentStep, onNodeClick, hidePruned, showLowPruningBorder, showOnlyLowPruning, lowPruningThreshold, graph }: TreeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoomLevel, setZoomLevel] = useState(1.25);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<TreeNode | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showHoverTooltip, setShowHoverTooltip] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const centerXRef = useRef<number>(0);
  const centerYRef = useRef<number>(0);

  // Update dimensions based on container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Clear only the content group, not the whole SVG
    svg.selectAll('.content-group').remove();

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) / 2 - 50;

    centerXRef.current = centerX;
    centerYRef.current = centerY;

    const g = svg.append('g')
      .attr('class', 'content-group');

    // Apply zoom and pan transform
    g.attr('transform', `translate(${centerX + panX},${centerY + panY}) scale(${zoomLevel})`);

    // Convert to hierarchy - ALWAYS use all children to maintain positions
    const root = d3.hierarchy(data, d => d.children);

    // Use cliques_in_subtree to determine node size
    root.sum(d => d.cliques_in_subtree || 1);

    // Create partition layout (Sunburst - radial) on FULL tree
    const partition = d3.partition<TreeNode>()
      .size([2 * Math.PI, radius]);

    const partitionData = partition(root);

    // Get ALL nodes from full tree (for stable positions)
    const allNodes = partitionData.descendants();

    // Helper function to check if node has low pruning effectiveness
    const isLowPruning = (d: d3.HierarchyRectangularNode<TreeNode>) => {
      const totalChildren = d.data.children_ids.length;
      if (totalChildren > 0 && !d.data.pruned_by_pivot) {
        const prunedChildren = d.children?.filter(child => child.data.pruned_by_pivot).length || 0;
        const pruningRatio = prunedChildren / totalChildren;
        return pruningRatio < (lowPruningThreshold / 100);
      }
      return false;
    };

    // Filter nodes if showOnlyLowPruning is enabled
    let nodesToLayout = allNodes;
    if (showOnlyLowPruning) {
      // Only include root and low-pruning nodes (and their ancestors for tree structure)
      const lowPruningNodes = new Set<d3.HierarchyRectangularNode<TreeNode>>();
      allNodes.forEach(node => {
        if (node.depth === 0 || isLowPruning(node)) {
          lowPruningNodes.add(node);
          // Add all ancestors
          let ancestor = node.parent;
          while (ancestor) {
            lowPruningNodes.add(ancestor);
            ancestor = ancestor.parent;
          }
        }
      });
      nodesToLayout = Array.from(lowPruningNodes);

      // Recalculate partition for filtered nodes
      const filteredRoot = d3.hierarchy(data, d => {
        if (!d.children) return undefined;
        return d.children.filter(child => {
          const nodeInHierarchy = allNodes.find(n => n.data.node_id === child.node_id);
          return nodeInHierarchy && lowPruningNodes.has(nodeInHierarchy);
        });
      });
      filteredRoot.sum(d => d.cliques_in_subtree || 1);
      const filteredPartition = partition(filteredRoot);
      const filteredNodes = filteredPartition.descendants();

      // Copy new angles to original nodes
      filteredNodes.forEach(fn => {
        const originalNode = allNodes.find(n => n.data.node_id === fn.data.node_id);
        if (originalNode) {
          originalNode.x0 = fn.x0;
          originalNode.x1 = fn.x1;
        }
      });
    }

    // Rescale angles so depth 1+ nodes use full 360 degrees
    const depth1Nodes = nodesToLayout.filter(d => d.depth === 1);
    if (depth1Nodes.length > 0) {
      const minAngle = Math.min(...depth1Nodes.map(d => d.x0));
      const maxAngle = Math.max(...depth1Nodes.map(d => d.x1));
      const angleRange = maxAngle - minAngle;

      if (angleRange > 0 && angleRange < 2 * Math.PI) {
        // Rescale all non-root nodes to use full 360 degrees
        nodesToLayout.filter(d => d.depth > 0).forEach(d => {
          d.x0 = ((d.x0 - minAngle) / angleRange) * 2 * Math.PI;
          d.x1 = ((d.x1 - minAngle) / angleRange) * 2 * Math.PI;
        });
      }
    }

    // NOW filter for rendering based on creation_order and pruned status
    const visibleNodes = nodesToLayout.filter(d => {
      if (d.data.creation_order > currentStep) return false;
      if (hidePruned && d.data.pruned_by_pivot) return false;
      if (showOnlyLowPruning && d.depth > 0 && !isLowPruning(d)) {
        // Check if it's an ancestor of a low-pruning node
        const hasLowPruningDescendant = (node: d3.HierarchyRectangularNode<TreeNode>): boolean => {
          if (isLowPruning(node)) return true;
          if (!node.children) return false;
          return node.children.some(hasLowPruningDescendant);
        };
        if (!hasLowPruningDescendant(d)) return false;
      }
      return true;
    });

    // Separate root and other nodes
    const rootNode = visibleNodes.find(d => d.depth === 0);
    const nonRootNodes = visibleNodes.filter(d => d.depth > 0);

    // Color scale with saturation based on cliques
    const getNodeColor = (d: d3.HierarchyRectangularNode<TreeNode>) => {
      const isFruitless = d.data.cliques_in_subtree === 0;

      // Pruned nodes: always keep original red color
      if (d.data.pruned_by_pivot) {
        return '#e74c3c';
      }

      // Base colors for each depth
      const depthHues = [210, 145, 30, 270, 170, 25]; // Blue, Green, Orange, Purple, Teal, Orange-red
      const hue = depthHues[d.depth % depthHues.length];

      // Fruitless nodes: very low saturation and high lightness
      if (isFruitless) {
        return `hsl(${hue}, 15%, 75%)`;
      }

      // Saturation based on cliques_in_subtree (0-100%)
      const maxCliques = 50; // Adjust based on your data
      const saturation = Math.min(100, 40 + (d.data.cliques_in_subtree / maxCliques) * 60);
      const lightness = 50;

      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    // Draw root node as a circle in the center
    if (rootNode) {
      g.append('circle')
        .attr('r', rootNode.y1)
        .attr('fill', getNodeColor(rootNode))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.3)
        .style('opacity', 0.9)
        .style('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          if (onNodeClick) {
            onNodeClick(rootNode.data);
          }
        })
        .on('mouseenter', function(event, d) {
          d3.select(this).style('opacity', 1).attr('stroke-width', 1.5);
          if (graph && rootNode.data.current_clique && showHoverTooltip) {
            setHoveredNode(rootNode.data);
            setMousePos({ x: event.clientX, y: event.clientY });
          }
        })
        .on('mousemove', function(event) {
          if (hoveredNode && hoveredNode.node_id === rootNode.data.node_id) {
            setMousePos({ x: event.clientX, y: event.clientY });
          }
        })
        .on('mouseleave', function() {
          d3.select(this).style('opacity', 0.9).attr('stroke-width', 0.3);
          setHoveredNode(null);
        });
    }

    // Arc generator for sunburst
    const arc = d3.arc<d3.HierarchyRectangularNode<TreeNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // Draw arcs for non-root nodes
    const cells = g.selectAll('.cell')
      .data(nonRootNodes)
      .enter()
      .append('g')
      .attr('class', 'cell')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onNodeClick) {
          onNodeClick(d.data);
        }
      });

    cells.append('path')
      .attr('d', arc)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => {
        // Check if this node has low pruning effectiveness
        if (showLowPruningBorder && isLowPruning(d)) {
          return '#ffd700';
        }
        return '#fff';
      })
      .attr('stroke-width', d => {
        if (showLowPruningBorder && isLowPruning(d)) {
          return 2;
        }
        return 0.3;
      })
      .style('opacity', 0.9)
      .on('mouseenter', function(event, d) {
        d3.select(this).style('opacity', 1).attr('stroke-width', (d: any) => {
          if (showLowPruningBorder && isLowPruning(d)) {
            return 3;
          }
          return 1.5;
        });
        if (graph && d.data.current_clique && showHoverTooltip) {
          setHoveredNode(d.data);
          setMousePos({ x: event.clientX, y: event.clientY });
        }
      })
      .on('mousemove', function(event, d) {
        if (hoveredNode && hoveredNode.node_id === d.data.node_id) {
          setMousePos({ x: event.clientX, y: event.clientY });
        }
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', 0.9).attr('stroke-width', (d: any) => {
          if (showLowPruningBorder && isLowPruning(d)) {
            return 2;
          }
          return 0.3;
        });
        setHoveredNode(null);
      });

    // Add text labels for larger arcs
    cells.filter(d => {
      const angle = d.x1 - d.x0;
      const radiusSpan = d.y1 - d.y0;
      return angle > 0.05 && radiusSpan > 20;
    })
      .append('text')
      .attr('transform', d => {
        const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI - 90;
        const radius = (d.y0 + d.y1) / 2;
        return `rotate(${angle}) translate(${radius},0) rotate(${angle > 90 ? 180 : 0})`;
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '9px')
      .style('fill', '#fff')
      .style('pointer-events', 'none')
      .style('font-weight', 'bold')
      .text(d => {
        const clique = d.data.current_clique;
        if (clique && clique.length < 15) return clique;
        return `${d.data.node_id}`;
      });

    // Update zoom and pan transform when they change
    svg.selectAll('.content-group')
      .transition()
      .duration(200)
      .attr('transform', `translate(${centerX + panX},${centerY + panY}) scale(${zoomLevel})`);

  }, [data, currentStep, dimensions, onNodeClick, hidePruned, showLowPruningBorder, showOnlyLowPruning, lowPruningThreshold, zoomLevel, panX, panY, hoveredNode, graph, showHoverTooltip]);

  // Handle mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only allow panning on left mouse button, and not on buttons/legend
    if (e.button === 0 && !isDragging) {
      const target = e.target as HTMLElement;
      // Don't start drag if clicking on buttons or legend
      if (target.closest('button') || target.closest('[style*="position: absolute"]')) {
        return;
      }
      setIsDragging(true);
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;
        // Store the initial mouse position and current pan offset
        setDragStart({ x: startX - panX, y: startY - panY });
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        // Calculate new pan based on mouse movement
        setPanX(currentX - dragStart.x);
        setPanY(currentY - dragStart.y);
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleMouseLeave = () => {
    // Keep dragging even when mouse leaves SVG for smoother panning
    // Also clear hovered node when mouse leaves SVG
    setHoveredNode(null);
  };

  // Add global mouse event listeners for smooth panning
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (svg && isDragging) {
        const rect = svg.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        setPanX(currentX - dragStart.x);
        setPanY(currentY - dragStart.y);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(3, prev + 0.1));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev - 0.1));
  };

  const handleZoomReset = () => {
    setZoomLevel(1.25);
    setPanX(0);
    setPanY(0);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#fafafa', border: '1px solid #ddd', borderRadius: '8px' }}>
      {/* Legend in top-left */}
      <div 
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 10,
          maxWidth: '220px',
          pointerEvents: 'auto'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <h4 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold' }}>Legend</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3498db',
              flexShrink: 0
            }} />
            <span>Depth 0</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#2ecc71',
              flexShrink: 0
            }} />
            <span>Depth 1</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#e74c3c',
              flexShrink: 0
            }} />
            <span>Pruned</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'hsl(210, 15%, 75%)',
              flexShrink: 0
            }} />
            <span>Fruitless</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3498db',
              border: '2px solid #ffd700',
              flexShrink: 0
            }} />
            <span>Low (&lt;{lowPruningThreshold}%)</span>
          </div>
          <div style={{ marginTop: '2px', fontSize: '9px', color: '#666' }}>
            Size = cliques
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        style={{
          background: '#fafafa',
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      {/* Hover Tooltip Toggle */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        zIndex: 10
      }}>
        <button
          onClick={() => setShowHoverTooltip(!showHoverTooltip)}
          style={{
            width: '35px',
            height: '28px',
            fontSize: '14px',
            cursor: 'pointer',
            background: showHoverTooltip ? '#2ecc71' : '#e74c3c',
            color: 'white',
            border: '2px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}
          title={showHoverTooltip ? 'Disable hover tooltip' : 'Enable hover tooltip'}
        >
          {showHoverTooltip ? '👁' : '🚫'}
        </button>
      </div>
      {/* Zoom Controls */}
      <div style={{
        position: 'absolute',
        top: '43px',
        right: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        zIndex: 10
      }}>
        <button
          onClick={handleZoomIn}
          style={{
            width: '35px',
            height: '35px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: 'white',
            border: '2px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          style={{
            width: '35px',
            height: '35px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: 'white',
            border: '2px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
        >
          −
        </button>
        <button
          onClick={handleZoomReset}
          style={{
            width: '35px',
            height: '28px',
            fontSize: '11px',
            cursor: 'pointer',
            background: 'white',
            border: '2px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#333'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
          title="Reset zoom"
        >
          ↻
        </button>
      </div>
      {/* Subgraph Tooltip */}
      <SubgraphTooltip
        node={hoveredNode}
        graph={graph || null}
        x={mousePos.x}
        y={mousePos.y}
        visible={showHoverTooltip && hoveredNode !== null && hoveredNode.current_clique !== null && hoveredNode.current_clique.trim() !== ''}
      />
    </div>
  );
}
