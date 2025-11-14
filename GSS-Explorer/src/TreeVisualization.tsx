import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

export function TreeVisualization({
  data,
  currentStep,
  onNodeClick,
  hidePruned,
}: TreeVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const initialDataRef = useRef<TreeNode | null>(null);
  const prevCollapsedNodesRef = useRef<Set<number>>(new Set());
  const prevNodeCountRef = useRef<number>(0);
  const gRef = useRef<SVGGElement | null>(null);
  const hasInitializedTransform = useRef<boolean>(false);
  const [dimensionsReady, setDimensionsReady] = useState(false);

  // Auto-collapse depth-1 nodes on initial load if there are many
  useEffect(() => {
    if (data && data !== initialDataRef.current) {
      initialDataRef.current = data;

      // Count direct children of root
      const rootChildren = data.children || [];

      // If there are more than 20 direct children, collapse them all initially
      if (rootChildren.length > 20) {
        const depth1NodeIds = rootChildren.map((child) => child.node_id);
        setCollapsedNodes(new Set(depth1NodeIds));
      }
    }
  }, [data]);

  // Update dimensions based on container size with debouncing
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
        // Mark dimensions as ready after first measurement
        if (!dimensionsReady && rect.width > 0 && rect.height > 0) {
          // Small delay to ensure dimensions are stable
          setTimeout(() => setDimensionsReady(true), 50);
        }
      }
    };

    // Debounce resize events to avoid excessive re-renders
    let timeoutId: number;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(updateDimensions, 150);
    };

    updateDimensions();
    window.addEventListener('resize', debouncedUpdate);
    return () => {
      window.removeEventListener('resize', debouncedUpdate);
      clearTimeout(timeoutId);
    };
  }, [dimensionsReady]);

  // Helper function to get node color
  const getNodeColor = (d: d3.HierarchyPointNode<TreeNode>) => {
    if (d.data.pruned_by_pivot) return '#e74c3c';

    // Base colors for each depth
    const depthHues = [210, 145, 30, 270, 170, 25]; // Blue, Green, Orange, Purple, Teal, Orange-red
    const hue = depthHues[d.depth % depthHues.length];

    // Saturation based on cliques_in_subtree (0-100%)
    const maxCliques = 50; // Adjust based on your data
    const saturation = Math.min(
      100,
      40 + (d.data.cliques_in_subtree / maxCliques) * 60
    );
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

  // Toggle collapse state - memoized to prevent unnecessary re-renders
  const handleCollapseToggle = useCallback((nodeId: number) => {
    setCollapsedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  // Recenter the view
  const handleRecenter = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;

    const svg = d3.select(svgRef.current);
    svg
      .transition()
      .duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // Memoize the filtering function to avoid recreating it on every render
  const filterChildren = useCallback(
    (node: TreeNode): TreeNode | null => {
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
    },
    [currentStep, hidePruned]
  );

  // Memoize filtered data to avoid recomputing on every render
  const filteredData = useMemo(() => {
    if (!data) return null;
    return filterChildren(data);
  }, [data, filterChildren]);

  useEffect(() => {
    if (!svgRef.current || !filteredData || !dimensionsReady) return;

    const svg = d3
      .select(svgRef.current)
      .attr('width', dimensions.width)
      .attr('height', dimensions.height);

    // Clear only the content group, not the whole SVG
    svg.selectAll('.content-group').remove();

    const margin = { top: 20, right: 120, bottom: 20, left: 80 };

    const g = svg.append('g').attr('class', 'content-group');
    gRef.current = g.node();

    const root = d3.hierarchy(filteredData, (d) => {
      // Hide children if node is collapsed
      if (collapsedNodes.has(d.node_id)) {
        return undefined;
      }
      return d.children;
    }) as HierarchyNodeWithCollapse;

    // Store reference to hidden children for toggle functionality
    const storeCollapsedChildren = (node: HierarchyNodeWithCollapse) => {
      if (collapsedNodes.has(node.data.node_id) && node.data.children) {
        node._children = d3.hierarchy(node.data, (d) => d.children).children as
          | HierarchyNodeWithCollapse[]
          | undefined;
      }
      if (node.children) {
        node.children.forEach(storeCollapsedChildren);
      }
    };
    storeCollapsedChildren(root);

    // Create tree layout with nodeSize for better spacing
    // nodeSize allocates fixed space per node to prevent overlap
    const verticalSpacing = 60; // Vertical space per node
    const horizontalSpacing = 200; // Horizontal space per level

    const treeLayout = d3
      .tree<TreeNode>()
      .nodeSize([verticalSpacing, horizontalSpacing])
      .separation((a, b) => {
        // Dynamic separation based on node sizes
        const radiusA = getNodeRadius(a);
        const radiusB = getNodeRadius(b);
        const textPadding = 40; // Account for text labels

        // Calculate minimum separation needed to prevent overlap
        const minSeparation =
          (radiusA + radiusB + textPadding) / verticalSpacing;

        // Siblings need more space, cousins even more
        return a.parent === b.parent
          ? Math.max(1.5, minSeparation)
          : Math.max(2.0, minSeparation * 1.3);
      });

    const treeData = treeLayout(root);
    const nodes = treeData.descendants();
    const links = treeData.links();

    // Calculate actual tree bounds for dynamic sizing
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    nodes.forEach((d) => {
      const nodeRadius = getNodeRadius(d);
      minX = Math.min(minX, d.x - nodeRadius);
      maxX = Math.max(maxX, d.x + nodeRadius);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    });

    // Calculate required dimensions
    const treeHeight = maxX - minX;

    // Update SVG dimensions to fit tree with margins
    const totalHeight = treeHeight + margin.top + margin.bottom + 100;
    svg.attr('height', Math.max(dimensions.height, totalHeight));

    // Always center the tree vertically in the available space
    const availableHeight = Math.max(dimensions.height, totalHeight);
    const verticalOffset = (availableHeight - treeHeight) / 2 - minX;

    // Create link path generator (horizontal orientation)
    const linkGenerator = d3
      .linkHorizontal<
        d3.HierarchyPointLink<TreeNode>,
        d3.HierarchyPointNode<TreeNode>
      >()
      .x((d) => d.y)
      .y((d) => d.x);

    // Helper to check if a node leads to any pruned descendants
    const hasOnlyPrunedDescendants = (
      node: d3.HierarchyPointNode<TreeNode>
    ): boolean => {
      if (!node.children || node.children.length === 0) {
        return node.data.pruned_by_pivot;
      }
      return node.children.every(hasOnlyPrunedDescendants);
    };

    // Determine if we should animate based on what changed
    // Only animate for collapse/expand operations, not timeline updates
    const collapsedNodesChanged =
      prevCollapsedNodesRef.current.size !== collapsedNodes.size ||
      Array.from(collapsedNodes).some(
        (id) => !prevCollapsedNodesRef.current.has(id)
      );

    const shouldAnimate =
      collapsedNodesChanged && nodes.length === prevNodeCountRef.current;

    // Update refs for next render
    prevCollapsedNodesRef.current = new Set(collapsedNodes);
    prevNodeCountRef.current = nodes.length;

    const duration = shouldAnimate ? 300 : 0; // Animate only for collapse/expand

    // Draw links
    const linkGroup = g
      .append('g')
      .attr('class', 'links')
      .attr('fill', 'none')
      .attr('stroke-width', 1.5);

    const link = linkGroup
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', linkGenerator)
      .attr('stroke', (d) =>
        hasOnlyPrunedDescendants(d.target) ? '#e74c3c' : '#999'
      )
      .attr('stroke-dasharray', (d) =>
        hasOnlyPrunedDescendants(d.target) ? '4,4' : '0'
      )
      .style('opacity', 0);

    // Transition links in
    link.transition().duration(duration).style('opacity', 0.6);

    // Draw nodes
    const nodeGroup = g.append('g').attr('class', 'nodes');

    const node = nodeGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.y},${d.x})`)
      .style('cursor', 'pointer')
      .style('opacity', 0);

    // Transition nodes in
    node.transition().duration(duration).style('opacity', 1);

    // Add circles for nodes
    node
      .append('circle')
      .attr('r', (d) => getNodeRadius(d))
      .attr('fill', (d) => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('opacity', 0.9)
      .on('click', function (event, d) {
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
      .on('mouseenter', function () {
        d3.select(this).style('opacity', 1).attr('stroke-width', 3);
      })
      .on('mouseleave', function () {
        d3.select(this).style('opacity', 0.9).attr('stroke-width', 2);
      });

    // Add collapse/expand indicator for nodes with children
    node
      .filter((d) => !!(d.data.children && d.data.children.length > 0))
      .append('circle')
      .attr('r', 5)
      .attr('fill', (d) =>
        collapsedNodes.has(d.data.node_id) ? '#fff' : '#333'
      )
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('click', function (event, d) {
        event.stopPropagation();
        handleCollapseToggle(d.data.node_id);
      });

    // Add +/- symbols for collapsed/expanded nodes
    node
      .filter((d) => !!(d.data.children && d.data.children.length > 0))
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', (d) =>
        collapsedNodes.has(d.data.node_id) ? '#333' : '#fff'
      )
      .style('pointer-events', 'none')
      .text((d) => (collapsedNodes.has(d.data.node_id) ? '+' : '−'));

    // Add text labels
    node
      .append('text')
      .attr('dy', (d) => {
        // Position text above nodes with children indicator
        return d.data.children && d.data.children.length > 0
          ? -getNodeRadius(d) - 8
          : 3;
      })
      .attr('x', (d) => getNodeRadius(d) + 8)
      .attr('text-anchor', 'start')
      .style('font-size', '11px')
      .style('fill', '#333')
      .style('pointer-events', 'none')
      .style('font-weight', '500')
      .text((d) => {
        const clique = d.data.current_clique;
        if (clique && clique.length < 30) return clique;
        return `Node ${d.data.node_id}`;
      });

    // Initialize zoom if not already done
    if (!zoomRef.current) {
      zoomRef.current = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          currentTransformRef.current = event.transform;
          g.attr('transform', event.transform.toString());
        });

      svg.call(zoomRef.current);
    } else {
      // Update zoom callback
      zoomRef.current.on('zoom', (event) => {
        currentTransformRef.current = event.transform;
        g.attr('transform', event.transform.toString());
      });
    }

    // Only apply initial centering transform on first render
    if (!hasInitializedTransform.current) {
      // Position to show the root node in viewport
      // Root is at y=0, so we need to translate it into the visible area
      // Center it horizontally at a reasonable starting position
      const initialX = Math.max(100, dimensions.width * 0.15); // Start from 15% of width or 100px minimum
      const initialY = verticalOffset;

      const initialTransform = d3.zoomIdentity.translate(initialX, initialY);

      // Apply transform immediately to the group for instant centering
      g.attr('transform', initialTransform.toString());

      // Update zoom behavior and ref without animation on initial render
      svg.call(zoomRef.current.transform, initialTransform);
      currentTransformRef.current = initialTransform;
      hasInitializedTransform.current = true;
    } else {
      // On subsequent renders, apply the current transform to maintain position
      g.attr('transform', currentTransformRef.current.toString());
    }
  }, [
    filteredData,
    dimensions,
    onNodeClick,
    collapsedNodes,
    handleCollapseToggle,
    dimensionsReady,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        position: 'relative',
      }}
    >
      <button
        onClick={handleRecenter}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          padding: '8px 16px',
          backgroundColor: '#fff',
          border: '1px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          color: 'black',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        Recenter
      </button>
      <svg
        ref={svgRef}
        style={{
          border: '1px solid #ddd',
          background: '#fafafa',
          display: 'block',
          minHeight: '100%',
        }}
      />
    </div>
  );
}
