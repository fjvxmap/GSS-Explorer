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
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const nodeSelectionRef = useRef<d3.Selection<SVGCircleElement, any, any, any> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<SVGLineElement, any, any, any> | null>(null);
  const labelGroupRef = useRef<d3.Selection<SVGGElement, any, any, any> | null>(null);
  const nodesDataRef = useRef<any[]>([]);
  const originalPositionsRef = useRef<Map<number, {x: number, y: number}>>(new Map());
  const svgGroupRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Update dimensions based on container size
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Use available space minus padding for title and legend
        const padding = 10;
        const titleHeight = 20;
        const legendHeight = 30;
        const availableHeight = Math.max(0, rect.height - titleHeight - legendHeight - padding);
        const availableWidth = Math.max(0, rect.width - padding);
        const size = Math.min(availableWidth, availableHeight);
        if (size > 80) { // Minimum size check
          setDimensions({ width: size, height: size });
        } else {
          setDimensions({ width: 250, height: 250 }); // Default fallback
        }
      }
    };

    // Initial update with delay to ensure container is rendered
    const timeoutId = setTimeout(updateDimensions, 50);
    
    // Update on window resize
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver if available for better tracking
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        setTimeout(updateDimensions, 50);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateDimensions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [graph]);

  // Initialize graph once
  useEffect(() => {
    if (!svgRef.current || !graph || !graph.edges) return;
    if (dimensions.width === 0 || dimensions.height === 0) return;
    if (initialized) {
      // Update SVG size if already initialized
      const svg = d3.select(svgRef.current);
      svg.attr('width', dimensions.width).attr('height', dimensions.height);
      return;
    }

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const g = svg.append('g');
    svgGroupRef.current = g;

    // Create nodes data
    const nodes = Array.from({ length: graph.numNodes }, (_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height
    }));
    nodesDataRef.current = nodes;

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
      .scaleExtent([0.3, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Stop simulation and save original positions after layout stabilizes
    setTimeout(() => {
      simulation.stop();
      // Save original positions
      nodes.forEach(node => {
        originalPositionsRef.current.set(node.id, { x: node.x, y: node.y });
      });
      setInitialized(true);
      }, 3000);

    return () => {
      simulation.stop();
    };
  }, [graph, initialized, dimensions]);

  // Update SVG size when dimensions change after initialization
  useEffect(() => {
    if (!svgRef.current || !initialized || dimensions.width === 0 || dimensions.height === 0) return;
    const svg = d3.select(svgRef.current);
    svg.attr('width', dimensions.width).attr('height', dimensions.height);
  }, [dimensions, initialized]);

  // Update colors and positions based on currentNode
  useEffect(() => {
    if (!initialized || !nodeSelectionRef.current || !linkSelectionRef.current || !labelGroupRef.current) return;
    if (!svgRef.current || !svgGroupRef.current || !zoomBehaviorRef.current) return;

    const nodes = nodesDataRef.current;
    const svg = d3.select(svgRef.current);

    if (currentNode && currentNode.current_clique) {
      // Parse R, P, X sets
      const rVertices = currentNode.current_clique ? currentNode.current_clique.split(';').filter(v => v).map(v => parseInt(v)) : [];
      const pVertices = currentNode.p_set ? currentNode.p_set.split(';').filter(v => v).map(v => parseInt(v)) : [];
      const xVertices = currentNode.x_set ? currentNode.x_set.split(';').filter(v => v).map(v => parseInt(v)) : [];

      const rSet = new Set(rVertices);
      const pSet = new Set(pVertices);
      const xSet = new Set(xVertices);

      // Rearrange positions: R in center column, P on left, X on right
      const centerX = 200;
      const centerY = 200;
      const columnSpacing = 80;
      const nodeSpacing = 30;

      // Sort vertices for consistent ordering
      const sortedR = rVertices.sort((a, b) => a - b);
      const sortedP = pVertices.sort((a, b) => a - b);
      const sortedX = xVertices.sort((a, b) => a - b);

      const maxCount = Math.max(sortedR.length, sortedP.length, sortedX.length);
      const startY = centerY - (maxCount - 1) * nodeSpacing / 2;

      // Position R (black) in center
      sortedR.forEach((id, idx) => {
        const node = nodes.find(n => n.id === id);
        if (node) {
          node.targetX = centerX;
          node.targetY = startY + idx * nodeSpacing;
        }
      });

      // Position P (blue) on left
      sortedP.forEach((id, idx) => {
        const node = nodes.find(n => n.id === id);
        if (node) {
          node.targetX = centerX - columnSpacing;
          node.targetY = startY + idx * nodeSpacing;
        }
      });

      // Position X (red) on right
      sortedX.forEach((id, idx) => {
        const node = nodes.find(n => n.id === id);
        if (node) {
          node.targetX = centerX + columnSpacing;
          node.targetY = startY + idx * nodeSpacing;
        }
      });

      // Keep other nodes at original positions
      nodes.forEach(node => {
        if (!rSet.has(node.id) && !pSet.has(node.id) && !xSet.has(node.id)) {
          const orig = originalPositionsRef.current.get(node.id);
          if (orig) {
            node.targetX = orig.x;
            node.targetY = orig.y;
          }
        }
      });

      // Animate to new positions
      nodeSelectionRef.current
        .transition()
        .duration(500)
        .attr('cx', (d: any) => {
          if (d.targetX !== undefined) {
            d.x = d.targetX;
            return d.targetX;
          }
          return d.x;
        })
        .attr('cy', (d: any) => {
          if (d.targetY !== undefined) {
            d.y = d.targetY;
            return d.targetY;
          }
          return d.y;
        })
        .attr('fill', (d: any) => {
          if (rSet.has(d.id)) return '#333';
          if (pSet.has(d.id)) return '#3498db';
          if (xSet.has(d.id)) return '#e74c3c';
          return '#ddd';
        })
        .attr('r', (d: any) => {
          if (rSet.has(d.id) || pSet.has(d.id) || xSet.has(d.id)) return 8;
          return 4;
        });

      linkSelectionRef.current
        .transition()
        .duration(500)
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
        .attr('stroke', (d: any) => {
          const inR = rSet.has(d.sourceId) && rSet.has(d.targetId);
          if (inR) return '#333';

          // R-P edge: one end in R, other in P
          const rToP = (rSet.has(d.sourceId) && pSet.has(d.targetId)) ||
                       (pSet.has(d.sourceId) && rSet.has(d.targetId));
          if (rToP) return '#3498db';

          // R-X edge: one end in R, other in X
          const rToX = (rSet.has(d.sourceId) && xSet.has(d.targetId)) ||
                       (xSet.has(d.sourceId) && rSet.has(d.targetId));
          if (rToX) return '#e74c3c';

          return '#ccc';
        })
        .attr('stroke-width', (d: any) => {
          const inR = rSet.has(d.sourceId) && rSet.has(d.targetId);
          const rToP = (rSet.has(d.sourceId) && pSet.has(d.targetId)) ||
                       (pSet.has(d.sourceId) && rSet.has(d.targetId));
          const rToX = (rSet.has(d.sourceId) && xSet.has(d.targetId)) ||
                       (xSet.has(d.sourceId) && rSet.has(d.targetId));
          if (inR || rToP || rToX) return 2;
          return 1;
        })
        .attr('stroke-opacity', (d: any) => {
          const anyRelevant = rSet.has(d.sourceId) || rSet.has(d.targetId) ||
                              pSet.has(d.sourceId) || pSet.has(d.targetId) ||
                              xSet.has(d.sourceId) || xSet.has(d.targetId);
          if (anyRelevant) return 0.8;
          return 0.2;
        });

      // Update labels for R, P, X
      const relevantNodes = nodes.filter((n: any) => rSet.has(n.id) || pSet.has(n.id) || xSet.has(n.id));

      const labels = labelGroupRef.current
        .selectAll<SVGTextElement, any>('text')
        .data(relevantNodes, (d: any) => d.id);

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
        .transition()
        .duration(500)
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);

      // Zoom to relevant area
      setTimeout(() => {
        const allRelevant = [...sortedR, ...sortedP, ...sortedX];
        if (allRelevant.length > 0) {
          const padding = 50;
          const bounds = {
            minX: centerX - columnSpacing - padding,
            maxX: centerX + columnSpacing + padding,
            minY: startY - padding,
            maxY: startY + (maxCount - 1) * nodeSpacing + padding
          };

          const width = bounds.maxX - bounds.minX;
          const height = bounds.maxY - bounds.minY;
          const midX = (bounds.minX + bounds.maxX) / 2;
          const midY = (bounds.minY + bounds.maxY) / 2;

          const scale = Math.min(350 / width, 350 / height, 3);
          const translate = [200 - scale * midX, 200 - scale * midY];

          svg.transition()
            .duration(500)
            .call(
              zoomBehaviorRef.current!.transform,
              d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        }
      }, 100);

    } else {
      // Reset to original positions
      nodeSelectionRef.current
        .transition()
        .duration(500)
        .attr('cx', (d: any) => {
          const orig = originalPositionsRef.current.get(d.id);
          if (orig) {
            d.x = orig.x;
            return orig.x;
          }
          return d.x;
        })
        .attr('cy', (d: any) => {
          const orig = originalPositionsRef.current.get(d.id);
          if (orig) {
            d.y = orig.y;
            return orig.y;
          }
          return d.y;
        })
        .attr('fill', '#aaa')
        .attr('r', 5);

      linkSelectionRef.current
        .transition()
        .duration(500)
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.6);

      labelGroupRef.current.selectAll('text').remove();

      // Reset zoom
      svg.transition()
        .duration(500)
        .call(zoomBehaviorRef.current!.transform, d3.zoomIdentity);
    }

  }, [currentNode, initialized]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', flexShrink: 0, fontWeight: 'bold' }}>Input Graph</h4>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <svg
          ref={svgRef}
          style={{
            border: '1px solid #ddd',
            background: '#fafafa',
            borderRadius: '4px',
            width: '100%',
            height: '100%',
            minHeight: 0,
            flex: 1
          }}
        />
        <div style={{ marginTop: '6px', fontSize: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#333'
            }} />
            <span>Current Clique (R)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#3498db'
            }} />
            <span>Candidates (P)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#e74c3c'
            }} />
            <span>Excluded (X)</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
