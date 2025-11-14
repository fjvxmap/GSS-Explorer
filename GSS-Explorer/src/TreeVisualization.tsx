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

// Extended type for D3 hierarchy with collapsed state
type HierarchyNodeWithCollapse = d3.HierarchyPointNode<TreeNode> & {
  _children?: HierarchyNodeWithCollapse[];
};

export function TreeVisualization({ data, maxStep, currentStep, onNodeClick, hidePruned }: TreeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());

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

  // Helper function to get node color
  const getNodeColor = (d: d3.HierarchyPointNode<TreeNode>) => {
    if (d.data.pruned_by_pivot) return '#e74c3c';

    // Base colors for each depth
    const depthHues = [210, 145, 30, 270, 170, 25]; // Blue, Green, Orange, Purple, Teal, Orange-red
    const hue = depthHues[d.depth % depthHues.length];

    // Saturation based on cliques_in_subtree (0-100%)
    const maxCliques = 50; // Adjust based on your data
    const saturation = Math.min(100, 40 + (d.data.cliques_in_subtree / maxCliques) * 60);
    const lightness = 50;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  // Helper function to get node radius based on cliques_in_subtree
  const getNodeRadius = (d: d3.HierarchyPointNode<TreeNode>) => {
    const baseRadius = 6;
    const maxRadius = 20;
    const cliques = d.data.cliques_in_subtree || 1;
    return Math.min(baseRadius + Math.sqrt(cliques) * 2, maxRadius);
  };

  // Toggle collapse state
  const handleCollapseToggle = (nodeId: number) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Clear only the content group, not the whole SVG
    svg.selectAll('.content-group').remove();

    const margin = { top: 20, right: 120, bottom: 20, left: 80 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('class', 'content-group');

    // Apply current zoom transform if it exists
    if (zoomRef.current) {
      const currentTransform = d3.zoomTransform(svg.node()!);
      g.attr('transform', `translate(${margin.left + currentTransform.x},${margin.top + currentTransform.y}) scale(${currentTransform.k})`);
    } else {
      g.attr('transform', `translate(${margin.left},${margin.top})`);
    }

    // Convert to hierarchy - filter children based on visibility
    const filterChildren = (node: TreeNode): TreeNode | null => {
      // Check visibility based on creation_order
      if (node.creation_order > currentStep) return null;
      if (hidePruned && node.pruned_by_pivot) return null;

      const filtered: TreeNode = { ...node };

      // Recursively filter children
      if (node.children && node.children.length > 0) {
        const visibleChildren = node.children
          .map(filterChildren)
          .filter((child): child is TreeNode => child !== null);

        if (visibleChildren.length > 0) {
          filtered.children = visibleChildren;
        } else {
          delete filtered.children;
        }
      }

      return filtered;
    };

    const filteredData = filterChildren(data);
    if (!filteredData) return;

    const root = d3.hierarchy(filteredData, d => {
      // Hide children if node is collapsed
      if (collapsedNodes.has(d.node_id)) {
        return undefined;
      }
      return d.children;
    }) as HierarchyNodeWithCollapse;

    // Store reference to hidden children for toggle functionality
    const storeCollapsedChildren = (node: HierarchyNodeWithCollapse) => {
      if (collapsedNodes.has(node.data.node_id) && node.data.children) {
        node._children = d3.hierarchy(node.data, d => d.children).children as HierarchyNodeWithCollapse[] | undefined;
      }
      if (node.children) {
        node.children.forEach(storeCollapsedChildren);
      }
    };
    storeCollapsedChildren(root);

    // Create tree layout
    const treeLayout = d3.tree<TreeNode>()
      .size([height, width])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Create link path generator (horizontal orientation)
    const linkGenerator = d3.linkHorizontal<d3.HierarchyPointLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
      .x(d => d.y)
      .y(d => d.x);

    // Helper to check if a node leads to any pruned descendants
    const hasOnlyPrunedDescendants = (node: d3.HierarchyPointNode<TreeNode>): boolean => {
      if (!node.children || node.children.length === 0) {
        return node.data.pruned_by_pivot;
      }
      return node.children.every(hasOnlyPrunedDescendants);
    };

    const duration = 300; // Transition duration in ms

    // Draw links
    const linkGroup = g.append('g')
      .attr('class', 'links')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5);

    const link = linkGroup.selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', linkGenerator)
      .attr('stroke', d => hasOnlyPrunedDescendants(d.target) ? '#e74c3c' : '#999')
      .attr('stroke-dasharray', d => hasOnlyPrunedDescendants(d.target) ? '4,4' : '0')
      .style('opacity', 0);

    // Transition links in
    link.transition()
      .duration(duration)
      .style('opacity', 0.6);

    // Draw nodes
    const nodeGroup = g.append('g')
      .attr('class', 'nodes');

    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .style('opacity', 0);

    // Transition nodes in
    node.transition()
      .duration(duration)
      .style('opacity', 1);

    // Add circles for nodes
    node.append('circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0.9)
      .on('click', function(event, d) {
        event.stopPropagation();

        // Check if node has children to collapse
        const hasChildren = d.data.children && d.data.children.length > 0;

        if (event.altKey && hasChildren) {
          // Alt+click to toggle collapse
          handleCollapseToggle(d.data.node_id);
        } else {
          // Regular click for selection
          if (onNodeClick) {
            onNodeClick(d.data);
          }
        }
      })
      .on('mouseenter', function() {
        d3.select(this).style('opacity', 1).attr('stroke-width', 3);
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', 0.9).attr('stroke-width', 2);
      });

    // Add collapse/expand indicator for nodes with children
    node.filter(d => !!(d.data.children && d.data.children.length > 0))
      .append('circle')
      .attr('r', 4)
      .attr('fill', d => collapsedNodes.has(d.data.node_id) ? '#fff' : '#333')
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', function(event, d) {
        event.stopPropagation();
        handleCollapseToggle(d.data.node_id);
      });

    // Add text labels
    node.append('text')
      .attr('dy', d => {
        // Position text above nodes with children indicator
        return (d.data.children && d.data.children.length > 0) ? -getNodeRadius(d) - 8 : 3;
      })
      .attr('x', d => getNodeRadius(d) + 8)
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('font-weight', '500')
      .text(d => {
        const clique = d.data.current_clique;
        if (clique && clique.length < 30) return clique;
        return `Node ${d.data.node_id}`;
      });

    // Initialize zoom if not already done
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          const transform = event.transform;
          svg.selectAll('.content-group')
            .attr('transform', `translate(${margin.left + transform.x},${margin.top + transform.y}) scale(${transform.k})`);
        });

      svg.call(zoomRef.current);
    } else {
      // Update zoom callback to work with new margins
      zoomRef.current.on('zoom', (event) => {
        const transform = event.transform;
        svg.selectAll('.content-group')
          .attr('transform', `translate(${margin.left + transform.x},${margin.top + transform.y}) scale(${transform.k})`);
      });
    }

  }, [data, currentStep, dimensions, onNodeClick, hidePruned, collapsedNodes]);

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
