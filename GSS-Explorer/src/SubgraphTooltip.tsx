import { useEffect, useRef } from 'react';
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

export function SubgraphTooltip({ node, graph, x, y, visible }: SubgraphTooltipProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!visible || !node || !graph || !svgRef.current || !node.current_clique) {
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      return;
    }

    // Parse clique vertices
    const cliqueVertices = node.current_clique
      .split(';')
      .filter(v => v.trim())
      .map(v => parseInt(v.trim()));

    if (cliqueVertices.length === 0) return;

    const cliqueSet = new Set(cliqueVertices);
    const width = 400;
    const height = 400;
    const scaleFactor = 0.75; // Scale down the entire graph

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Build adjacency list for BFS
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

    // BFS to find all nodes within 3-4 hops from clique vertices
    const includedNodes = new Set<number>(cliqueVertices);
    const maxHops = 4;
    
    // Start BFS from each clique vertex
    cliqueVertices.forEach(startVertex => {
      const visited = new Set<number>();
      const queue: Array<{ node: number; depth: number }> = [{ node: startVertex, depth: 0 }];
      visited.add(startVertex);

      while (queue.length > 0) {
        const { node, depth } = queue.shift()!;
        
        if (depth >= maxHops) continue;

        const neighbors = adjacencyList.get(node) || new Set();
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

    // Extract subgraph edges (edges between any included nodes)
    const subgraphEdges = graph.edges.filter(edge => 
      includedNodes.has(edge.source) && includedNodes.has(edge.target)
    );

    // Create nodes for all included vertices
    const nodes = Array.from(includedNodes).map(id => ({
      id,
      x: 0,
      y: 0,
      isClique: cliqueSet.has(id)
    }));

    // Create links
    const links = subgraphEdges.map(edge => ({
      source: nodes.find(n => n.id === edge.source)!,
      target: nodes.find(n => n.id === edge.target)!,
      sourceId: edge.source,
      targetId: edge.target
    }));

    // Force simulation for layout - scaled down for better fit
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        // Closer connections for clique nodes, scaled down
        return (d.source.isClique && d.target.isClique ? 30 : 45) * scaleFactor;
      }))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => (d.isClique ? 12 : 9) * scaleFactor));

    // Draw links - in same transformed group
    const linkGroup = g.append('g')
      .attr('transform', `translate(${width/2}, ${height/2}) scale(${scaleFactor}) translate(${-width/2}, ${-height/2})`);
    linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8);

    // Draw nodes - scaled down
    const nodeGroup = g.append('g')
      .attr('transform', `translate(${width/2}, ${height/2}) scale(${scaleFactor}) translate(${-width/2}, ${-height/2})`);
    const nodeSelection = nodeGroup
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d: any) => d.isClique ? 10 : 7)
      .attr('fill', (d: any) => d.isClique ? '#3498db' : '#95a5a6')
      .attr('stroke', '#fff')
      .attr('stroke-width', (d: any) => d.isClique ? 2 : 1.5)
      .attr('opacity', (d: any) => d.isClique ? 1 : 0.8);

    // Draw labels - in same transformed group
    const labelGroup = g.append('g')
      .attr('transform', `translate(${width/2}, ${height/2}) scale(${scaleFactor}) translate(${-width/2}, ${-height/2})`);
    labelGroup
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', (d: any) => d.isClique ? '11px' : '9px')
      .style('fill', '#fff')
      .style('font-weight', (d: any) => d.isClique ? 'bold' : 'normal')
      .style('pointer-events', 'none')
      .text((d: any) => d.id);

    // Update positions on tick
    simulation.on('tick', () => {
      linkGroup.selectAll('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodeSelection
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labelGroup.selectAll('text')
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    // Stop simulation after layout stabilizes
    setTimeout(() => {
      simulation.stop();
    }, 1000);

    return () => {
      simulation.stop();
    };
  }, [node, graph, visible]);

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
        Clique: {node.current_clique}
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

