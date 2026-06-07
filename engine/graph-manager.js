// engine/graph-manager.js — P-Reinforce Knowledge Graph Manager
// Maintains Graph.json as an adjacency list with CRUD operations

const path = require('path');
const { ROOT_DIR, readJsonSafe, writeJson, generateUUID } = require('./utils');

const GRAPH_PATH = path.join(ROOT_DIR, '20_Meta', 'Graph.json');

const EMPTY_GRAPH = { nodes: [], edges: [], metadata: { totalNodes: 0, totalEdges: 0, lastUpdated: null } };

/**
 * Read the current knowledge graph
 */
function readGraph() {
    return readJsonSafe(GRAPH_PATH, { ...EMPTY_GRAPH, nodes: [], edges: [], metadata: { ...EMPTY_GRAPH.metadata } });
}

/**
 * Write the graph back to disk
 */
function saveGraph(graph) {
    graph.metadata = graph.metadata || {};
    graph.metadata.totalNodes = graph.nodes.length;
    graph.metadata.totalEdges = graph.edges.length;
    graph.metadata.lastUpdated = new Date().toISOString();
    writeJson(GRAPH_PATH, graph);
}

/**
 * Add a node to the graph
 * @param {Object} nodeData - { title, path, category, tags, confidenceScore }
 * @returns {Object} The created node (with id)
 */
function addNode(nodeData) {
    const graph = readGraph();
    const node = {
        id: nodeData.id || generateUUID(),
        title: nodeData.title,
        path: nodeData.path,
        category: nodeData.category,
        tags: nodeData.tags || [],
        confidenceScore: nodeData.confidenceScore || 0.5,
        createdAt: new Date().toISOString()
    };

    // Avoid duplicates by path
    const existing = graph.nodes.find(n => n.path === node.path);
    if (existing) {
        Object.assign(existing, node, { id: existing.id });
        saveGraph(graph);
        return existing;
    }

    graph.nodes.push(node);
    saveGraph(graph);
    return node;
}

/**
 * Add an edge (link) between two nodes
 * @param {string} sourceId - Source node ID
 * @param {string} targetId - Target node ID
 * @param {'related'|'parent'|'child'|'raw_source'|'contradicts'} type
 */
function addEdge(sourceId, targetId, type = 'related') {
    const graph = readGraph();

    // Avoid duplicate edges
    const exists = graph.edges.some(
        e => e.source === sourceId && e.target === targetId && e.type === type
    );
    if (exists) return;

    graph.edges.push({
        id: generateUUID(),
        source: sourceId,
        target: targetId,
        type,
        createdAt: new Date().toISOString()
    });

    saveGraph(graph);
}

/**
 * Remove a node and all its connected edges
 */
function removeNode(nodeId) {
    const graph = readGraph();
    graph.nodes = graph.nodes.filter(n => n.id !== nodeId);
    graph.edges = graph.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    saveGraph(graph);
}

/**
 * Find a node by its wiki path
 */
function findNodeByPath(wikiPath) {
    const graph = readGraph();
    return graph.nodes.find(n => n.path === wikiPath) || null;
}

/**
 * Find a node by its ID
 */
function findNodeById(nodeId) {
    const graph = readGraph();
    return graph.nodes.find(n => n.id === nodeId) || null;
}

/**
 * Find related nodes for a given node (nodes connected by edges)
 * @returns {Array} Array of related node objects
 */
function findRelated(nodeId) {
    const graph = readGraph();
    const connectedIds = new Set();

    for (const edge of graph.edges) {
        if (edge.source === nodeId) connectedIds.add(edge.target);
        if (edge.target === nodeId) connectedIds.add(edge.source);
    }

    return graph.nodes.filter(n => connectedIds.has(n.id));
}

/**
 * Calculate the graph connectivity score (0.0 ~ 1.0)
 * Measures how well-connected the graph is:
 *   connectivity = (actual edges) / (max possible edges for a connected graph)
 * Bounded to [0, 1]
 */
function connectivityScore() {
    const graph = readGraph();
    const n = graph.nodes.length;
    if (n <= 1) return 1.0;

    // For a "well-connected" graph, we expect at least (n - 1) edges (spanning tree)
    // and ideally ~ 2*n edges (each node has ~2 connections on average)
    const idealEdges = Math.max(n * 2, n - 1);
    const actual = graph.edges.length;

    return Math.min(1.0, actual / idealEdges);
}

/**
 * Find the top N most similar nodes to a given keyword vector
 * @param {Object} keywordVec - { word: weight, ... }
 * @param {number} topN - Number of results
 * @returns {Array} [{ node, similarity }, ...]
 */
function findSimilarNodes(keywordVec, topN = 5) {
    const graph = readGraph();
    const { extractKeywords, cosineSimilarity } = require('./utils');
    const fs = require('fs');

    const scored = [];
    for (const node of graph.nodes) {
        // Build keyword vector from node title + tags
        const nodeText = [node.title, ...(node.tags || [])].join(' ');
        const nodeVec = extractKeywords(nodeText);
        const sim = cosineSimilarity(keywordVec, nodeVec);
        scored.push({ node, similarity: sim });
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topN);
}

/**
 * Update a node's path (used when moving documents)
 */
function updateNodePath(nodeId, newPath, newCategory) {
    const graph = readGraph();
    const node = graph.nodes.find(n => n.id === nodeId);
    if (node) {
        node.path = newPath;
        if (newCategory) node.category = newCategory;
        saveGraph(graph);
    }
}

module.exports = {
    readGraph,
    saveGraph,
    addNode,
    addEdge,
    removeNode,
    findNodeByPath,
    findNodeById,
    findRelated,
    connectivityScore,
    findSimilarNodes,
    updateNodePath,
    GRAPH_PATH
};
