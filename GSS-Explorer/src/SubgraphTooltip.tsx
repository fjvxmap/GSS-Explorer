import { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { Graph } from './graphTypes';
import type { TreeNode } from './types';

interface SubgraphTooltipProps {
  node: TreeNode | null;
  graph: Graph | null;
  x: number;
  y: number;
  visible: boolean;
}

interface NodePosition {
  id: number;
  x: number;
  y: number;
}

export function SubgraphTooltip({ node, graph, x, y, visible }: SubgraphTooltipProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Map<number, NodePosition>>(new Map());
  const [layoutReady, setLayoutReady] = useState(false);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  // Initialize positions only once when graph changes
  useEffect(() => {
    if (!graph || !graph.edges) {
      setPositions(new Map());
      setLayoutReady(false);
      return;
    }

    const width = 400;
    const height = 400;

    // Create nodes for all vertices
    const nodes = Array.from({ length: graph.numNodes }, (_, i) => ({
      id: i,
      x: width / 2 + (Math.random() - 0.5) * 100,
      y: height / 2 + (Math.random() - 0.5) * 100
    }));

    // Create links
    const links = graph.edges.map(edge => ({
      source: nodes[edge.source],
      target: nodes[edge.target],
      sourceId: edge.source,
      targetId: edge.target
    }));

    // Force simulation for layout
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(25))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(8));

    simulationRef.current = simulation;

    // Run simulation and save final positions
    simulation.on('end', () => {
      const posMap = new Map<number, NodePosition>();
      nodes.forEach(n => {
        posMap.set(n.id, { id: n.id, x: n.x, y: n.y });
      });
      setPositions(posMap);
      setLayoutReady(true);
    });

    // Run simulation for a while to stabilize
    for (let i = 0; i < 300; i++) {
      simulation.tick();
    }
    simulation.stop();

    const posMap = new Map<number, NodePosition>();
    nodes.forEach(n => {
      posMap.set(n.id, { id: n.id, x: n.x, y: n.y });
    });
    setPositions(posMap);
    setLayoutReady(true);

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [graph]);

  // Parse clique, P, X vertices from current node
  const { cliqueSet, pSet, xSet } = useMemo(() => {
    if (!node) return { cliqueSet: new Set<number>(), pSet: new Set<number>(), xSet: new Set<number>() };

    const parseSet = (str: string | undefined) => {
      if (!str) return new Set<number>();
      return new Set(str.split(';').filter(v => v.trim()).map(v => parseInt(v.trim())));
    };

    return {
      cliqueSet: parseSet(node.current_clique),
      pSet: parseSet(node.p_set),
      xSet: parseSet(node.x_set)
    };
  }, [node]);

  // Render the graph with current highlighting
  useEffect(() => {
    if (!visible || !graph || !svgRef.current || !layoutReady || positions.size === 0) {
      return;
    }

    const width = 400;
    const height = 400;
    const scaleFactor = 0.75;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g')
      .attr('transform', `translate(${width/2}, ${height/2}) scale(${scaleFactor}) translate(${-width/2}, ${-height/2})`);

    // Filter to only show nodes within a few hops of highlighted nodes
    const highlightedNodes = new Set([...cliqueSet, ...pSet, ...xSet]);

    // If no highlighted nodes, show nothing special
    if (highlightedNodes.size === 0) {
      return;
    }

    // Build adjacency list
    const adjacencyList: Map<number, Set<number>> = new Map();
    graph.edges.forEach(edge => {
      if (!adjacencyList.has(edge.source)) {
        adjacencyList.set(edge.source, new Set());
      }
      if (!adjacencyList.has(edge.target)) {
        adjacencyList.set(edge.target, new Set());
      }
      adjacencyList.get(edge.source)!.add(edge.target);
      adjacencyList.get(edge.target)!.add(edge.source);
    });

    // BFS to find nodes within 3 hops
    const includedNodes = new Set<number>(highlightedNodes);
    const maxHops = 3;

    highlightedNodes.forEach(startVertex => {
      const visited = new Set<number>();
      const queue: Array<{ node: number; depth: number }> = [{ node: startVertex, depth: 0 }];
      visited.add(startVertex);

      while (queue.length > 0) {
        const { node: currentNode, depth } = queue.shift()!;

        if (depth >= maxHops) continue;

        const neighbors = adjacencyList.get(currentNode) || new Set();
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            includedNodes.add(neighbor);
            if (depth + 1 < maxHops) {
              queue.push({ node: neighbor, depth: depth + 1 });
            }
          }
        });
      }
    });

    // Filter edges
    const subgraphEdges = graph.edges.filter(edge =>
      includedNodes.has(edge.source) && includedNodes.has(edge.target)
    );

    // Draw links
    g.selectAll('line')
      .data(subgraphEdges)
      .enter()
      .append('line')
      .attr('x1', d => positions.get(d.source)?.x || 0)
      .attr('y1', d => positions.get(d.source)?.y || 0)
      .attr('x2', d => positions.get(d.target)?.x || 0)
      .attr('y2', d => positions.get(d.target)?.y || 0)
      .attr('stroke', d => {
        // R-R edges: black
        if (cliqueSet.has(d.source) && cliqueSet.has(d.target)) return '#333';
        // R-P edges: blue
        if ((cliqueSet.has(d.source) && pSet.has(d.target)) ||
            (pSet.has(d.source) && cliqueSet.has(d.target))) return '#3498db';
        // R-X edges: red
        if ((cliqueSet.has(d.source) && xSet.has(d.target)) ||
            (xSet.has(d.source) && cliqueSet.has(d.target))) return '#e74c3c';
        return '#999';
      })
      .attr('stroke-width', d => {
        if (cliqueSet.has(d.source) || cliqueSet.has(d.target) ||
            pSet.has(d.source) || pSet.has(d.target) ||
            xSet.has(d.source) || xSet.has(d.target)) return 2;
        return 1;
      })
      .attr('stroke-opacity', d => {
        if (cliqueSet.has(d.source) || cliqueSet.has(d.target) ||
            pSet.has(d.source) || pSet.has(d.target) ||
            xSet.has(d.source) || xSet.has(d.target)) return 0.9;
        return 0.4;
      });

    // Create node data array
    const nodeData = Array.from(includedNodes).map(id => ({
      id,
      x: positions.get(id)?.x || 0,
      y: positions.get(id)?.y || 0,
      isClique: cliqueSet.has(id),
      isP: pSet.has(id),
      isX: xSet.has(id)
    }));

    // Sort to render highlighted nodes last (on top)
    nodeData.sort((a, b) => {
      const aHighlight = a.isClique || a.isP || a.isX ? 1 : 0;
      const bHighlight = b.isClique || b.isP || b.isX ? 1 : 0;
      return aHighlight - bHighlight;
    });

    // Draw nodes
    g.selectAll('circle')
      .data(nodeData)
      .enter()
      .append('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => (d.isClique || d.isP || d.isX) ? 10 : 6)
      .attr('fill', d => {
        if (d.isClique) return '#333';
        if (d.isP) return '#3498db';
        if (d.isX) return '#e74c3c';
        return '#aaa';
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', d => (d.isClique || d.isP || d.isX) ? 2 : 1)
      .attr('opacity', d => (d.isClique || d.isP || d.isX) ? 1 : 0.6);

    // Draw labels for highlighted nodes
    g.selectAll('text')
      .data(nodeData.filter(d => d.isClique || d.isP || d.isX))
      .enter()
      .append('text')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => d.id);

  }, [visible, graph, layoutReady, positions, cliqueSet, pSet, xSet]);

  if (!visible || !node || !node.current_clique) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: `${x + 15}px`,
        top: `${y - 200}px`,
        width: '400px',
        height: '400px',
        background: 'white',
        border: '2px solid #333',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
        pointerEvents: 'none',
        padding: '5px',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '5px',
        left: '5px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#333',
        zIndex: 1001
      }}>
        R: {node.current_clique || 'empty'} | P: {node.p_set || 'empty'} | X: {node.x_set || 'empty'}
      </div>
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
}
