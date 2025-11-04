#include <chrono>

#include "graph.h"

using namespace std;

int main(int argc, char* argv[]) {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    // Check if CSV export is requested
    bool export_csv = false;
    string csv_filename = "search_tree.csv";

    for (int i = 1; i < argc; i++) {
        string arg = argv[i];
        if (arg == "--export-tree" || arg == "-e") {
            export_csv = true;
            if (i + 1 < argc && argv[i + 1][0] != '-') {
                csv_filename = argv[++i];
            }
        }
    }

    Graph g;
    if (!g.readGraph()) {
        cerr << "Error reading graph\n";
        return 1;
    }
    // g.printGraph();

    // Enable search tree tracking if export is requested
    if (export_csv) {
        g.enable_search_tree_tracking();
        cout << "Search tree tracking enabled\n";
    }

    auto start = chrono::high_resolution_clock::now();
    g.dgn_order_cal();
    g.bron_kerbosch_degeneracy();
    auto end = chrono::high_resolution_clock::now();
    chrono::duration<double> elapsed = end - start;

    cout << "Clique count: " << g.clique_count << "\n";
    cout << "Elapsed Time: " << elapsed.count() * 1000 << " ms\n";

    // Export search tree if requested
    if (export_csv) {
        g.print_search_tree_stats();
        g.export_search_tree_to_csv(csv_filename);
    }

    return 0;
}
