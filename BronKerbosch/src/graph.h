#include <bits/stdc++.h>

#include <chrono>
#include <fstream>

using namespace std;

// Structure to track search tree nodes
struct SearchTreeNode {
    int node_id;
    int parent_id;
    vector<int> children_ids;
    int cliques_in_subtree;
    int creation_order;
    int depth;
    vector<int> current_clique;  // R set
    int p_size;  // size of P set
    int x_size;  // size of X set
    int candidate_vertex;  // the vertex being added to R
    bool pruned_by_pivot;  // true if this node would not be explored with pivoting
};

class Graph {
private:
    int num_vertices;
    int num_edges;
    vector<vector<int>> adj_list;
    vector<int> degrees;
    int max_degree;
    vector<int> v_list;
    vector<int> rev_idx;
    vector<int> clique;

    // Search tree tracking
    vector<SearchTreeNode> search_tree_nodes;
    int node_counter;
    bool track_search_tree;

public:
    vector<int> dgn_order, rev_dgn;
    int clique_count = 0;
    int numVertices() const { return num_vertices; }
    int numEdges() const { return num_edges; }

    const vector<int>& getNeighbors(int u) const {
        return adj_list[u];
    }

    int readGraph() {
        if (!(cin >> num_vertices >> num_edges)) return 0;
        adj_list.resize(num_vertices);
        degrees.resize(num_vertices, 0);

        int u, v;
        for (int i = 0; i < num_edges; i++) {
            cin >> u >> v;
            degrees[u]++;
            degrees[v]++;
            adj_list[u].push_back(v);
            adj_list[v].push_back(u);
        }

        max_degree = 0;
        for (int i = 0; i < num_vertices; i++)
            max_degree = max(max_degree, degrees[i]);
        return 1;
    }

    void printGraph() {
        cout << "Number of vertices: " << num_vertices << "\n";
        cout << "Number of edges: " << num_edges << "\n";

        for (int u = 0; u < num_vertices; u++) {
            cout << u << ":";
            for (int v : adj_list[u]) {
                cout << ' ' << v;
            }
            cout << "\n";
        }
    }

    void dgn_order_cal() {
        vector<list<int>> D(max_degree + 1);
        vector<list<int>::iterator> it(num_vertices);
        vector<int> cur_deg(degrees);

        for (int v = 0; v < num_vertices; v++) {
            D[degrees[v]].push_back(v);
            it[v] = prev(D[degrees[v]].end());
        }
        for (int i = 0; i <= max_degree; i++) {
            if (i >= 0 && !D[i].empty()) {
                int v = D[i].front();
                dgn_order.push_back(v);
                D[i].erase(D[i].begin());
                cur_deg[v] = 0;
                for (int u : adj_list[v])
                    if (cur_deg[u] != 0) {
                        D[cur_deg[u]].erase(it[u]);
                        D[--cur_deg[u]].push_back(u);
                        it[u] = prev(D[cur_deg[u]].end());
                    }
                i -= 2;
            }
        }

        rev_dgn.resize(num_vertices);
        for (int i = 0; i < num_vertices; i++) rev_dgn[dgn_order[i]] = i;
    }

    int bron_kerbosch_pivot(int x_idx, int p_idx, int e_idx, int depth = 0, int parent_node_id = -1, int cand_vertex = -1, bool is_pruned = false) {
        int current_node_id = -1;

        // Track this node if enabled
        if (track_search_tree) {
            current_node_id = node_counter++;
            SearchTreeNode node;
            node.node_id = current_node_id;
            node.parent_id = parent_node_id;
            node.creation_order = search_tree_nodes.size();
            node.depth = depth;
            node.current_clique = clique;
            node.x_size = p_idx - x_idx;
            node.p_size = e_idx - p_idx;
            node.candidate_vertex = cand_vertex;
            node.cliques_in_subtree = 0;
            node.pruned_by_pivot = is_pruned;
            search_tree_nodes.push_back(node);

            // Add this node as a child of parent
            if (parent_node_id >= 0 && parent_node_id < search_tree_nodes.size()) {
                search_tree_nodes[parent_node_id].children_ids.push_back(current_node_id);
            }
        }

        if (x_idx == p_idx && p_idx == e_idx) {
            // Only count cliques if not in a pruned branch
            if (!is_pruned) {
                clique_count++;
            }
            if (track_search_tree && current_node_id >= 0) {
                search_tree_nodes[current_node_id].cliques_in_subtree = 1;
            }
            return 1;  // Return number of cliques found
        }

        int total_cliques = 0;

        int pivot = -1;
        int _max_degree = -1;
        for (int i = x_idx; i < e_idx; i++) {
            int v = v_list[i];
            int n_v = 0;
            for (int u : adj_list[v]) {
                if (rev_idx[u] < p_idx || rev_idx[u] >= e_idx)
                    break;
                n_v++;
            }
            if (n_v > _max_degree) {
                pivot = v_list[i];
                _max_degree = n_v;
            }
        }

        // Collect all P candidates (without pivot pruning)
        vector<int> all_p_candidates;
        for (int i = p_idx; i < e_idx; i++) {
            all_p_candidates.push_back(v_list[i]);
        }

        // Collect pivot neighbors to determine pruned candidates
        vector<bool> pivot_neigh(e_idx - p_idx);
        for (int v : adj_list[pivot]) {
            if (rev_idx[v] < p_idx || rev_idx[v] >= e_idx) break;
            pivot_neigh[rev_idx[v] - p_idx] = true;
        }

        // Separate candidates into pruned and non-pruned
        vector<int> r_candidates;  // Non-pruned (will be explored)
        vector<int> pruned_candidates;  // Pruned by pivot
        for (int i = p_idx; i < e_idx; i++) {
            if (!pivot_neigh[i - p_idx]) {
                r_candidates.push_back(v_list[i]);
            } else {
                pruned_candidates.push_back(v_list[i]);
            }
        }
        int num_candidates = r_candidates.size();
        pivot_neigh.clear();

        for (int cand : r_candidates) {
            int num_x = 0;
            for (int j = p_idx - 1; j >= x_idx; j--) {
                int _is_neighbor = 0;
                for (int v : adj_list[v_list[j]]) {
                    if (rev_idx[v] < p_idx || rev_idx[v] >= e_idx) break;
                    if (v == cand) {
                        _is_neighbor = 1;
                        break;
                    }
                }
                if (_is_neighbor) {
                    num_x++;
                    rev_idx[v_list[j]] = p_idx - num_x;
                    rev_idx[v_list[p_idx - num_x]] = j;
                    swap(v_list[j], v_list[p_idx - num_x]);
                }
            }

            int num_p = 0;
            for (int j = p_idx; j < e_idx; j++) {
                int _is_neighbor = 0;
                for (int v : adj_list[v_list[j]]) {
                    if (rev_idx[v] < p_idx || rev_idx[v] >= e_idx) break;
                    if (v == cand) {
                        _is_neighbor = 1;
                        break;
                    }
                }
                if (_is_neighbor) {
                    rev_idx[v_list[j]] = p_idx + num_p;
                    rev_idx[v_list[p_idx + num_p]] = j;
                    swap(v_list[j], v_list[p_idx + num_p]);
                    num_p++;
                }
            }

            for (int i = p_idx - num_x; i < p_idx + num_p; i++) {
                auto& neighbors = adj_list[v_list[i]];
                int write = 0;

                for (int read = 0; read < (int)neighbors.size(); ++read) {
                    int w = neighbors[read];
                    if (rev_idx[w] < p_idx || rev_idx[w] >= e_idx)
                        break;

                    if (rev_idx[w] >= p_idx && rev_idx[w] < p_idx + num_p) {
                        std::swap(neighbors[write], neighbors[read]);
                        ++write;
                    }
                }
            }

            clique.push_back(cand);
            int subtree_cliques = bron_kerbosch_pivot(p_idx - num_x, p_idx, p_idx + num_p, depth + 1, current_node_id, cand, false);
            total_cliques += subtree_cliques;
            clique.pop_back();

            for (int i = p_idx - num_x; i < p_idx + num_p; i++) {
                for (auto it = adj_list[v_list[i]].begin();;) {
                    if (it == adj_list[v_list[i]].end() || rev_idx[*it] < p_idx || rev_idx[*it] >= e_idx) {
                        adj_list[v_list[i]].insert(it, cand);
                        break;
                    }
                    int w = *it;
                    if (w == cand) {
                        it++;
                        adj_list[v_list[i]].erase(prev(it));
                    } else
                        it++;
                }
            }

            rev_idx[v_list[p_idx]] = rev_idx[cand];
            rev_idx[cand] = p_idx;
            swap(v_list[p_idx], v_list[rev_idx[v_list[p_idx]]]);
            p_idx++;
        }

        for (int i = 0; i < num_candidates; i++) {
            rev_idx[v_list[p_idx - i - 1]] = rev_idx[r_candidates[i]];
            rev_idx[r_candidates[i]] = p_idx - i - 1;
            swap(v_list[p_idx - i - 1], v_list[rev_idx[v_list[p_idx - i - 1]]]);
        }

        // Explore pruned candidates (only if tracking enabled)
        // These are explored to show what would have been searched without pivot
        if (track_search_tree && current_node_id >= 0) {
            // Save current state
            vector<int> saved_v_list = v_list;
            vector<int> saved_rev_idx = rev_idx;
            vector<vector<int>> saved_adj_list = adj_list;

            for (int cand : pruned_candidates) {
                // Restore state for each pruned candidate
                v_list = saved_v_list;
                rev_idx = saved_rev_idx;
                adj_list = saved_adj_list;

                // Compute X' and P' for the pruned candidate
                int num_x = 0;
                for (int j = p_idx - 1; j >= x_idx; j--) {
                    int _is_neighbor = 0;
                    for (int v : adj_list[v_list[j]]) {
                        if (rev_idx[v] < p_idx || rev_idx[v] >= e_idx)
                            break;
                        if (v == cand) {
                            _is_neighbor = 1;
                            break;
                        }
                    }
                    if (_is_neighbor) {
                        num_x++;
                        rev_idx[v_list[j]] = p_idx - num_x;
                        rev_idx[v_list[p_idx - num_x]] = j;
                        swap(v_list[j], v_list[p_idx - num_x]);
                    }
                }

                int num_p = 0;
                for (int j = p_idx; j < e_idx; j++) {
                    int _is_neighbor = 0;
                    for (int v : adj_list[v_list[j]]) {
                        if (rev_idx[v] < p_idx || rev_idx[v] >= e_idx)
                            break;
                        if (v == cand) {
                            _is_neighbor = 1;
                            break;
                        }
                    }
                    if (_is_neighbor) {
                        rev_idx[v_list[j]] = p_idx + num_p;
                        rev_idx[v_list[p_idx + num_p]] = j;
                        swap(v_list[j], v_list[p_idx + num_p]);
                        num_p++;
                    }
                }

                for (int i = p_idx - num_x; i < p_idx + num_p; i++) {
                    auto& neighbors = adj_list[v_list[i]];
                    int write = 0;

                    for (int read = 0; read < (int)neighbors.size(); ++read) {
                        int w = neighbors[read];
                        if (rev_idx[w] < p_idx || rev_idx[w] >= e_idx)
                            break;

                        if (rev_idx[w] >= p_idx && rev_idx[w] < p_idx + num_p) {
                            std::swap(neighbors[write], neighbors[read]);
                            ++write;
                        }
                    }
                }

                clique.push_back(cand);
                bron_kerbosch_pivot(p_idx - num_x, p_idx, p_idx + num_p, depth + 1, current_node_id, cand, true);
                clique.pop_back();
            }

            // Restore original state after all pruned candidates
            v_list = saved_v_list;
            rev_idx = saved_rev_idx;
            adj_list = saved_adj_list;
        }

        if (track_search_tree && current_node_id >= 0) {
            search_tree_nodes[current_node_id].cliques_in_subtree = total_cliques;
        }

        return total_cliques;
    }

    // Basic Bron-Kerbosch without degeneracy ordering
    void bron_kerbosch_basic() {
        rev_idx.clear();
        rev_idx.resize(num_vertices, -1);

        // Start with R = {}, P = all vertices, X = {}
        // We iterate over all vertices (similar to degeneracy but in natural order)
        for (int i = 0; i < num_vertices; i++) {
            int v = i;
            vector<int> P, X;

            // For basic version without degeneracy:
            // X = neighbors with index < i
            // P = neighbors with index > i
            for (int u : adj_list[v]) {
                if (u < i)
                    X.push_back(u);
                else
                    P.push_back(u);
            }

            v_list.clear();
            v_list.insert(v_list.end(), X.begin(), X.end());
            v_list.insert(v_list.end(), P.begin(), P.end());

            for (int j = 0; j < v_list.size(); j++) rev_idx[v_list[j]] = j;

            for (int u : v_list) {
                auto& neighbors = adj_list[u];
                int write = 0;

                for (int read = 0; read < (int)neighbors.size(); ++read) {
                    int w = neighbors[read];
                    if (rev_idx[w] >= X.size() && rev_idx[w] < v_list.size()) {
                        std::swap(neighbors[write], neighbors[read]);
                        ++write;
                    }
                }
            }

            clique.push_back(v);
            bron_kerbosch_pivot(0, X.size(), v_list.size());
            clique.pop_back();

            for (int j = 0; j < v_list.size(); j++) {
                rev_idx[v_list[j]] = -1;
            }
        }
    }

    void bron_kerbosch_degeneracy() {
        rev_idx.clear();
        rev_idx.resize(num_vertices, -1);
        for (int i = 0; i < num_vertices; i++) {
            int v = dgn_order[i];
            vector<int> P, X;
            for (int u : adj_list[v]) {
                if (rev_dgn[u] < i)
                    X.push_back(u);
                else
                    P.push_back(u);
            }
            v_list.clear();
            v_list.insert(v_list.end(), X.begin(), X.end());
            v_list.insert(v_list.end(), P.begin(), P.end());

            for (int j = 0; j < v_list.size(); j++) rev_idx[v_list[j]] = j;

            for (int u : v_list) {
                auto& neighbors = adj_list[u];
                int write = 0;

                for (int read = 0; read < (int)neighbors.size(); ++read) {
                    int w = neighbors[read];
                    if (rev_idx[w] >= X.size() && rev_idx[w] < v_list.size()) {
                        std::swap(neighbors[write], neighbors[read]);
                        ++write;
                    }
                }
            }

            clique.push_back(v);
            bron_kerbosch_pivot(0, X.size(), v_list.size());
            clique.pop_back();

            for (int j = 0; j < v_list.size(); j++) {
                rev_idx[v_list[j]] = -1;
            }
        }
    }

    // Enable search tree tracking
    void enable_search_tree_tracking() {
        track_search_tree = true;
        node_counter = 0;
        search_tree_nodes.clear();
    }

    // Disable search tree tracking
    void disable_search_tree_tracking() {
        track_search_tree = false;
    }

    // Export search tree to CSV
    void export_search_tree_to_csv(const string& filename) {
        ofstream csv_file(filename);
        if (!csv_file.is_open()) {
            cerr << "Error: Could not open file " << filename << " for writing." << endl;
            return;
        }

        // Write CSV header
        csv_file << "node_id,parent_id,children_ids,cliques_in_subtree,creation_order,depth,"
                 << "candidate_vertex,current_clique,x_size,p_size,pruned_by_pivot" << endl;

        // Find all root nodes (parent_id == -1) and calculate total cliques
        vector<int> root_nodes;
        int total_root_cliques = 0;
        for (const auto& node : search_tree_nodes) {
            if (node.parent_id == -1) {
                root_nodes.push_back(node.node_id);
                total_root_cliques += node.cliques_in_subtree;
            }
        }

        // Write virtual root node (node_id = -1)
        csv_file << "-1,-2,\"";
        for (size_t i = 0; i < root_nodes.size(); i++) {
            if (i > 0) csv_file << ";";
            csv_file << root_nodes[i];
        }
        csv_file << "\"," << total_root_cliques << ",-1,-1,-1,\"\",0,0,false" << endl;

        // Write each actual node
        for (const auto& node : search_tree_nodes) {
            csv_file << node.node_id << ",";
            csv_file << node.parent_id << ",";

            // Children IDs (semicolon-separated)
            csv_file << "\"";
            for (size_t i = 0; i < node.children_ids.size(); i++) {
                if (i > 0) csv_file << ";";
                csv_file << node.children_ids[i];
            }
            csv_file << "\",";

            csv_file << node.cliques_in_subtree << ",";
            csv_file << node.creation_order << ",";
            csv_file << node.depth << ",";
            csv_file << node.candidate_vertex << ",";

            // Current clique (semicolon-separated)
            csv_file << "\"";
            for (size_t i = 0; i < node.current_clique.size(); i++) {
                if (i > 0) csv_file << ";";
                csv_file << node.current_clique[i];
            }
            csv_file << "\",";

            csv_file << node.x_size << ",";
            csv_file << node.p_size << ",";
            csv_file << (node.pruned_by_pivot ? "true" : "false") << endl;
        }

        csv_file.close();
        cout << "Search tree exported to " << filename << " (" << (search_tree_nodes.size() + 1) << " nodes including virtual root)" << endl;
    }

    // Get statistics about the search tree
    void print_search_tree_stats() {
        if (search_tree_nodes.empty()) {
            cout << "No search tree data available." << endl;
            return;
        }

        int max_depth = 0;
        int total_cliques = 0;
        int leaf_nodes = 0;
        int pruned_nodes = 0;
        int explored_nodes = 0;

        for (const auto& node : search_tree_nodes) {
            max_depth = max(max_depth, node.depth);
            if (node.children_ids.empty()) {
                leaf_nodes++;
                total_cliques += node.cliques_in_subtree;
            }
            if (node.pruned_by_pivot) {
                pruned_nodes++;
            } else {
                explored_nodes++;
            }
        }

        cout << "Search Tree Statistics:" << endl;
        cout << "  Total nodes: " << search_tree_nodes.size() << endl;
        cout << "  Explored nodes (with pivot): " << explored_nodes << endl;
        cout << "  Pruned nodes (by pivot): " << pruned_nodes << endl;
        cout << "  Pruning ratio: " << (pruned_nodes * 100.0 / search_tree_nodes.size()) << "%" << endl;
        cout << "  Leaf nodes: " << leaf_nodes << endl;
        cout << "  Max depth: " << max_depth << endl;
        cout << "  Total cliques found: " << clique_count << endl;
    }
};
