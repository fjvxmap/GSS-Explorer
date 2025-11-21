import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { TreeNode } from './types';

interface TreeVisualizationProps {
  data: TreeNode;
  maxStep: number;
  currentStep: number;
  onNodeClick?: (node: TreeNode) => void;
  hidePruned: boolean;
}

export function TreeVisualization({ data, maxStep, currentStep, onNodeClick, hidePruned }: TreeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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

    const g = svg.append('g')
      .attr('class', 'content-group');

    // Apply current zoom transform if it exists
    if (zoomRef.current) {
      const currentTransform = d3.zoomTransform(svg.node()!);
      g.attr('transform', `translate(${centerX + currentTransform.x},${centerY + currentTransform.y}) scale(${currentTransform.k})`);
    } else {
      g.attr('transform', `translate(${centerX},${centerY})`);
    }

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

    // Rescale angles so depth 1+ nodes use full 360 degrees
    const depth1Nodes = allNodes.filter(d => d.depth === 1);
    if (depth1Nodes.length > 0) {
      const minAngle = Math.min(...depth1Nodes.map(d => d.x0));
      const maxAngle = Math.max(...depth1Nodes.map(d => d.x1));
      const angleRange = maxAngle - minAngle;

      if (angleRange > 0 && angleRange < 2 * Math.PI) {
        // Rescale all non-root nodes to use full 360 degrees
        allNodes.filter(d => d.depth > 0).forEach(d => {
          d.x0 = ((d.x0 - minAngle) / angleRange) * 2 * Math.PI;
          d.x1 = ((d.x1 - minAngle) / angleRange) * 2 * Math.PI;
        });
      }
    }

    // NOW filter for rendering based on creation_order and pruned status
    const visibleNodes = allNodes.filter(d => {
      if (d.data.creation_order > currentStep) return false;
      if (hidePruned && d.data.pruned_by_pivot) return false;
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
        .on('mouseenter', function() {
          d3.select(this).style('opacity', 1).attr('stroke-width', 1.5);
        })
        .on('mouseleave', function() {
          d3.select(this).style('opacity', 0.9).attr('stroke-width', 0.3);
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
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.3)
      .style('opacity', 0.9)
      .on('mouseenter', function() {
        d3.select(this).style('opacity', 1).attr('stroke-width', 1.5);
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', 0.9).attr('stroke-width', 0.3);
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

    // Initialize zoom if not already done, or update the zoom target
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 5])
        .on('zoom', (event) => {
          const transform = event.transform;
          // Apply zoom to all .content-group elements
          svg.selectAll('.content-group')
            .attr('transform', `translate(${centerX + transform.x},${centerY + transform.y}) scale(${transform.k})`);
        });

      svg.call(zoomRef.current);
    } else {
      // Don't reset zoom, just update the zoom callback to work with new content
      zoomRef.current.on('zoom', (event) => {
        const transform = event.transform;
        svg.selectAll('.content-group')
          .attr('transform', `translate(${centerX + transform.x},${centerY + transform.y}) scale(${transform.k})`);
      });
    }

  }, [data, currentStep, dimensions, onNodeClick, hidePruned]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <svg
        ref={svgRef}
        style={{
          border: '1px solid #ddd',
          background: '#fafafa',
          display: 'block'
        }}
      />
    </div>
  );
}
