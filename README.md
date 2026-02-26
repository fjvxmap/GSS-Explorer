# Graph Algorithm Search Space Visualization

Tools for analyzing and visualizing the search space of the Bron-Kerbosch algorithm for maximum clique enumeration.

## Overview

The Bron-Kerbosch algorithm is a recursive backtracking algorithm used to find all maximal cliques in an undirected graph. This project provides:

1. **BronKerbosch**: A C++ implementation that generates search tree data
2. **GSS-Explorer**: An interactive web-based visualization tool for exploring the generated search spaces

---

## BronKerbosch

A C++ implementation of the Bron-Kerbosch algorithm with degeneracy ordering and pivot selection. The program can export detailed search tree information for visualization.

### Requirements

- C++ compiler with C++11 support (g++ recommended)
- Make

### Compilation

```bash
cd BronKerbosch
make        # Compile the program
make clean  # Remove compiled binary
```

This creates an executable named `main`.

### Usage

The program reads graph data from standard input and outputs clique enumeration results.

**Basic usage:**
```bash
./main < dataset/karate.txt
```

**Export search tree to CSV:**
```bash
./main -e [output.csv] < dataset/karate.txt
```

Options:
- `-e, --export-tree [filename]`: Export search tree data to CSV file (default: `search_tree.csv`)

**Example:**
```bash
# Run on karate club network and export search tree
./main -e karate_tree.csv < dataset/karate.txt

# Run on larger dataset
./main -e twitter_tree.csv < dataset/twitter.txt
```

### Input Format

Graph files should be in edge list format:
```
<num_vertices> <num_edges>
<vertex1> <vertex2>
<vertex1> <vertex3>
...
```

Example (`karate.txt`):
```
34 78
0 1
2 1
...
```

### Output

**Standard output:**
- Number of maximal cliques found
- Execution time in milliseconds

**CSV output** (with `-e` option):

The exported CSV contains detailed information about each node in the search tree:

| Column | Description |
|--------|-------------|
| `node_id` | Unique identifier for the search tree node |
| `parent_id` | ID of the parent node (-1 for root) |
| `creation_order` | Order in which nodes were created during search |
| `depth` | Depth of the node in the search tree |
| `current_clique` | Current clique (R set) at this node |
| `p_size` | Size of candidate set (P) |
| `x_size` | Size of excluded set (X) |
| `candidate_vertex` | Vertex being added to the clique |
| `pruned_by_pivot` | Whether this branch is pruned by pivot selection |
| `cliques_in_subtree` | Number of maximal cliques in this subtree |

This CSV file can be loaded into GSS-Explorer for interactive visualization.

### Available Datasets

The `dataset/` directory includes several real-world network datasets:
- `karate.txt` - Zachary's Karate Club (34 vertices)
- `adjnoun.txt` - Word adjacencies (112 vertices)
- `football.txt` - College football teams (115 vertices)
- `lesmis.txt` - Les Misérables character network (77 vertices)
- `political-books.txt` - Political books co-purchasing (105 vertices)
- `twitter.txt` - Twitter social network
- `DBLP.txt` - DBLP co-authorship network
- And more...

---

## GSS-Explorer

An interactive web-based visualization tool for exploring Bron-Kerbosch algorithm search spaces. Built with React, TypeScript, and D3.js.

### Requirements

- Node.js (v16 or higher recommended)
- Yarn package manager

### Setup and Running

```bash
cd GSS-Explorer
yarn install  # Install dependencies
yarn dev      # Start development server
```

The application will open at `http://localhost:5173` (or another available port).

### Usage

1. **Upload Files**: On the initial screen, upload two files:
   - CSV file: Search tree data exported from BronKerbosch (using `-e` option)
   - Graph file: Original graph edge list (same format as input to BronKerbosch)

2. **Explore the Visualization**: The interface is divided into several panels:

   **Left Panel:**
   - **Timeline Control**: Scrub through the search process step-by-step or use play/pause for automatic playback
   - **Pivot Pruning Toggle**: Show/hide nodes that would be pruned by pivot selection
   - **Search Tree Visualization**: Radial (sunburst) layout showing the complete search tree
     - Node size represents the number of cliques in each subtree
     - Color indicates depth in the search tree
     - Click nodes to inspect details
     - Zoom and pan to explore large trees

   **Right Panel:**
   - **Input Graph Visualization**: Force-directed layout of the original graph
     - Current clique is highlighted in real-time during playback
     - Nodes in the clique are shown in red
     - Edges within the clique are emphasized

   - **Node Information Panel**: Detailed information about the selected search tree node
     - Current clique (R set)
     - Candidate set size (P)
     - Excluded set size (X)
     - Number of solutions in subtree
     - Whether the node is pruned by pivoting
     - List of all maximal cliques found in the subtree

### Features

- **Interactive Timeline**: Navigate through the search process chronologically
- **Dual Visualization**: See both the search tree structure and the graph being processed
- **Real-time Highlighting**: Watch cliques grow as you step through the algorithm
- **Pivot Analysis**: Toggle visibility of pruned branches to understand pivot optimization
- **Zoom & Pan**: Explore large search spaces with smooth zoom interactions
- **Auto-tracking**: Automatically follows the most recent node during playback
- **Detailed Statistics**: View comprehensive information about each search tree node

### Technology Stack

- **React 19** with TypeScript
- **D3.js v7** for visualizations
- **Vite** for fast development and building

---

## Workflow Example

```bash
# 1. Generate search tree data
cd BronKerbosch
make
./main -e karate_tree.csv < dataset/karate.txt

# 2. Visualize the search space
cd ../GSS-Explorer
yarn dev

# 3. In the browser:
#    - Upload karate_tree.csv
#    - Upload dataset/karate.txt
#    - Explore the visualization!
```

---
