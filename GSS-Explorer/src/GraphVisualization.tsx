import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Graph } from './graphTypes';
import type { TreeNode } from './types';

interface GraphVisualizationProps {
  graph: Graph;
  currentNode: TreeNode | null;
}

export function GraphVisualization({ graph, currentNode }: GraphVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [initialized, setInitialized] = useState(false);
  const nodeSelectionRef = useRef<d3.Selection<SVGCircleElement, any, any, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<SVGLineElement, any, any, any> | null>(null);
  const labelGroupRef = useRef<d3.Selection<SVGGElement, any, any, any> | null>(null);

  // Initialize graph once
  useEffect(() => {
    if (!svgRef.current || !graph || !graph.edges) return;
    if (initialized) return;

    const width = 400;
    const height = 400;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Create nodes data
    const nodes = Array.from({ length: graph.numNodes }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height
    }));

    // Create links data with actual node references
    const links = graph.edges.map(edge => ({
      source: nodes[edge.source],
      target: nodes[edge.target],
      sourceId: edge.source,
      targetId: edge.target
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(30))
      .force('charge', d3.forceManyBody().strength(-50))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(8));

    // Draw links
    const linkGroup = g.append('g');
    const linkSelection = linkGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'graph-link')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    linkSelectionRef.current = linkSelection as any;

    // Draw nodes
    const nodeGroup = g.append('g');
    const nodeSelection = nodeGroup
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('class', 'graph-node')
      .attr('r', 5)
      .attr('fill', '#aaa')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    nodeSelectionRef.current = nodeSelection as any;

    // Labels group
    const labelGroup = g.append('g').attr('class', 'labels');
    labelGroupRef.current = labelGroup;

    // Update positions on simulation tick
    simulation.on('tick', () => {
      linkSelection
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

    // Add zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Stop simulation after layout stabilizes
    setTimeout(() => {
      simulation.stop();
    }, 3000);

    setInitialized(true);

    return () => {
      simulation.stop();
    };
  }, [graph, initialized]);

  // Update colors based on currentNode
  useEffect(() => {
    if (!initialized || !nodeSelectionRef.current || !linkSelectionRef.current || !labelGroupRef.current) return;

    let currentCliqueSet = new Set<number>();

    if (currentNode && currentNode.current_clique) {
      const cliqueVertices = currentNode.current_clique.split(';').map(v => parseInt(v));
      currentCliqueSet = new Set(cliqueVertices);
    }

    // Update node colors
    nodeSelectionRef.current
      .transition()
      .duration(100)
      .attr('fill', (d: any) => {
        if (currentCliqueSet.has(d.id)) return '#ff6b6b';
        return '#aaa';
      })
      .attr('r', (d: any) => {
        if (currentCliqueSet.has(d.id)) return 7;
        return 5;
      });

    // Update link colors (highlight edges between clique nodes)
    linkSelectionRef.current
      .transition()
      .duration(100)
      .attr('stroke', (d: any) => {
        if (currentCliqueSet.has(d.sourceId) && currentCliqueSet.has(d.targetId)) {
          return '#ff6b6b';
        }
        return '#999';
      })
      .attr('stroke-width', (d: any) => {
        if (currentCliqueSet.has(d.sourceId) && currentCliqueSet.has(d.targetId)) {
          return 3;
        }
        return 1;
      })
      .attr('stroke-opacity', (d: any) => {
        if (currentCliqueSet.has(d.sourceId) && currentCliqueSet.has(d.targetId)) {
          return 0.9;
        }
        return 0.6;
      });

    // Update labels
    const cliqueNodes = nodeSelectionRef.current.data().filter((d: any) => currentCliqueSet.has(d.id));

    const labels = labelGroupRef.current
      .selectAll<SVGTextElement, any>('text')
      .data(cliqueNodes, (d: any) => d.id);

    labels.exit().remove();

    labels.enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', '#fff')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .merge(labels)
      .text((d: any) => d.id)
      .attr('x', (d: any) => d.x)
      .attr('y', (d: any) => d.y);

  }, [currentNode, initialized]);

  return (
    <div>
      <h4 style={{ margin: '0 0 10px 0' }}>Input Graph</h4>
      <svg
        ref={svgRef}
        style={{
          border: '1px solid #ddd',
          background: '#fafafa',
          borderRadius: '4px'
        }}
      />
      <div style={{ marginTop: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#ff6b6b'
            }} />
            <span>Current Clique</span>
          </div>
        </div>
      </div>
    </div>
  );
}
