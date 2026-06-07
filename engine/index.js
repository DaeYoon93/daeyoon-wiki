// engine/index.js — P-Reinforce Engine Entry Point
// File watcher + Express API server + Processing pipeline

const express = require('express');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const {
    ROOT_DIR,
    extractTitle,
    extractKeywords,
    sanitizeFilename,
    ensureDir,
    getDateFolder,
    listMarkdownFiles,
    isoNow
} = require('./utils');
const categorizer = require('./categorizer');
const wikiGen = require('./wiki-generator');
const graphManager = require('./graph-manager');
const policyManager = require('./policy-manager');
const gitSync = require('./git-sync');
const { parseOfficeFile, SUPPORTED_EXTENSIONS } = require('./parsers');

const TEXT_EXTENSIONS = ['.md', '.txt', '.json'];
const ALL_EXTENSIONS = [...TEXT_EXTENSIONS, ...SUPPORTED_EXTENSIONS];

// ─── Paths ──────────────────────────────────────────────
const RAW_DIR = path.join(ROOT_DIR, '00_Raw');
const WIKI_DIR = path.join(ROOT_DIR, '10_Wiki');
const META_DIR = path.join(ROOT_DIR, '20_Meta');
const DASHBOARD_DIR = path.join(ROOT_DIR, 'dashboard');
const INDEX_PATH = path.join(META_DIR, 'Index.md');

const PORT = 3000;
const app = express();

// ─── Middleware ──────────────────────────────────────────
app.use(express.json());
app.use(express.static(DASHBOARD_DIR));

// ─── Processing Queue (prevents race conditions) ────────
let processingQueue = [];
let isProcessing = false;

/**
 * ═══════════════════════════════════════════════════════
 *  CORE PIPELINE: Raw → Categorize → Wiki → Graph → Git
 * ═══════════════════════════════════════════════════════
 */
async function processRawFile(filePath) {
    const filename = path.basename(filePath);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`[Pipeline] 📥 Processing: ${filename}`);
    console.log(`${'═'.repeat(60)}`);

    try {
        // 1. Read raw content (Office files go through parser first)
        let rawContent;
        if (SUPPORTED_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) {
            console.log(`[Pipeline] 📊 Parsing Office file: ${filename}`);
            rawContent = await parseOfficeFile(filePath);
        } else {
            rawContent = fs.readFileSync(filePath, 'utf-8');
        }

        if (rawContent.trim().length === 0) {
            console.log('[Pipeline] ⏭️  Empty file, skipping');
            return;
        }

        const title = extractTitle(rawContent);
        console.log(`[Pipeline] 📝 Title: "${title}"`);

        // 2. Categorize (RL State → Action)
        const classification = categorizer.categorize(rawContent);
        console.log(`[Pipeline] 🧠 Category: ${classification.category}`);
        console.log(`[Pipeline] 📊 Confidence: ${(classification.confidenceScore * 100).toFixed(1)}%`);
        console.log(`[Pipeline] 🎯 Action: ${classification.action}`);

        if (classification.needsRefactoring) {
            console.log('[Pipeline] ⚠️  Refactoring suggested for folder');
        }

        // 3. Determine target directory
        let targetCategoryPath = classification.category;
        if (classification.subcategory) {
            targetCategoryPath = path.join(classification.category, classification.subcategory);
        }
        const targetDir = path.join(WIKI_DIR, targetCategoryPath);
        ensureDir(targetDir);

        // 4. Find related documents for linking
        const contentVec = extractKeywords(rawContent);
        const similarNodes = graphManager.findSimilarNodes(contentVec, 3);
        const relatedDocs = similarNodes
            .filter(s => s.similarity > 0.1)
            .map(s => ({ title: s.node.title, path: s.node.path }));

        console.log(`[Pipeline] 🔗 Related docs found: ${relatedDocs.length}`);

        // 5. Auto-generate tags
        const tags = wikiGen.autoGenerateTags(rawContent, 5);

        // 6. Generate wiki document
        const rawRelativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
        const parentCategory = targetCategoryPath.split(/[\\/]/)[0];

        const wikiDoc = wikiGen.generateWikiDocument({
            rawContent,
            title,
            categoryPath: `10_Wiki/${targetCategoryPath}`.replace(/\\/g, '/'),
            confidenceScore: classification.confidenceScore,
            tags,
            rawSourcePath: `00_Raw/${rawRelativePath.replace('00_Raw/', '')}`,
            parentCategory,
            relatedDocs
        });

        // 7. Write wiki file
        const wikiFilename = sanitizeFilename(title) + '.md';
        const wikiFilePath = path.join(targetDir, wikiFilename);
        fs.writeFileSync(wikiFilePath, wikiDoc.content, 'utf-8');
        console.log(`[Pipeline] 📄 Wiki created: ${path.relative(ROOT_DIR, wikiFilePath)}`);

        // 8. Update knowledge graph
        const wikiRelPath = path.relative(ROOT_DIR, wikiFilePath).replace(/\\/g, '/');
        const node = graphManager.addNode({
            id: wikiDoc.id,
            title,
            path: wikiRelPath,
            category: targetCategoryPath,
            tags,
            confidenceScore: classification.confidenceScore
        });

        // Add edges to related documents
        for (const related of similarNodes.filter(s => s.similarity > 0.1)) {
            graphManager.addEdge(node.id, related.node.id, 'related');
        }

        console.log(`[Pipeline] 🕸️  Graph updated: ${graphManager.readGraph().nodes.length} nodes, ${graphManager.readGraph().edges.length} edges`);

        // 9. Update Index.md
        updateIndex();

        // 10. Git sync
        const commitSummary = `"${targetCategoryPath}" 폴더에 "${title}" 문서 생성 (confidence: ${(classification.confidenceScore * 100).toFixed(0)}%)`;
        const commitHash = await gitSync.fullSync(commitSummary);

        if (commitHash) {
            console.log(`[Pipeline] 🔄 Git commit: ${commitHash.substring(0, 7)}`);
        }

        // 11. Log reward score
        console.log(`[Pipeline] 🏆 Reward Score: ${classification.rewardScore.toFixed(3)}`);
        console.log(`[Pipeline] ✅ Pipeline complete for "${title}"\n`);

    } catch (err) {
        console.error(`[Pipeline] ❌ Error processing ${filename}:`, err.message);
        console.error(err.stack);
    }
}

/**
 * Process queue sequentially to avoid race conditions
 */
async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;

    while (processingQueue.length > 0) {
        const filePath = processingQueue.shift();
        await processRawFile(filePath);
    }

    isProcessing = false;
}

/**
 * Update the 20_Meta/Index.md table of contents
 */
function updateIndex() {
    const graph = graphManager.readGraph();
    const categories = {};

    for (const node of graph.nodes) {
        const cat = node.category || 'Uncategorized';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(node);
    }

    let indexContent = `---
title: "P-Reinforce Wiki Index"
type: index
last_updated: "${isoNow()}"
total_documents: ${graph.nodes.length}
---

# 📚 P-Reinforce 지식 위키 (Knowledge Index)

> 자동 생성된 목차입니다. 총 **${graph.nodes.length}**개의 문서가 연결되어 있습니다.

---

`;

    const sortedCategories = Object.keys(categories).sort();
    for (const cat of sortedCategories) {
        const nodes = categories[cat];
        const catEmoji = cat.startsWith('🛠️') ? '🛠️' :
                         cat.startsWith('💡') ? '💡' :
                         cat.startsWith('⚖️') ? '⚖️' :
                         cat.startsWith('🚀') ? '🚀' : '📁';

        indexContent += `## ${catEmoji} ${cat}\n\n`;

        for (const node of nodes) {
            const confidence = (node.confidenceScore * 100).toFixed(0);
            indexContent += `- [[${node.title}]] — \`confidence: ${confidence}%\` | tags: ${(node.tags || []).join(', ')}\n`;
        }
        indexContent += '\n';
    }

    indexContent += `---\n\n_마지막 업데이트: ${new Date().toLocaleString('ko-KR')}_\n`;

    ensureDir(META_DIR);
    fs.writeFileSync(INDEX_PATH, indexContent, 'utf-8');
}

/**
 * ═══════════════════════════════════════════════════════
 *  EXPRESS API ENDPOINTS
 * ═══════════════════════════════════════════════════════
 */

// GET /api/graph — Knowledge graph data
app.get('/api/graph', (req, res) => {
    const graph = graphManager.readGraph();
    res.json(graph);
});

// GET /api/wiki/:path — Read a wiki document
app.get('/api/wiki/*', (req, res) => {
    const wikiPath = req.params[0];
    const fullPath = path.join(ROOT_DIR, wikiPath);

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Document not found' });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ path: wikiPath, content });
});

// GET /api/index — Wiki table of contents
app.get('/api/index', (req, res) => {
    if (fs.existsSync(INDEX_PATH)) {
        const content = fs.readFileSync(INDEX_PATH, 'utf-8');
        res.json({ content });
    } else {
        res.json({ content: '_Index not yet generated._' });
    }
});

// GET /api/policy — Current RL policy
app.get('/api/policy', (req, res) => {
    const policy = policyManager.readPolicy();
    res.json(policy);
});

// POST /api/feedback — Submit user feedback
app.post('/api/feedback', (req, res) => {
    const { type, data } = req.body;

    if (!type || !data) {
        return res.status(400).json({ error: 'Missing type or data' });
    }

    const validTypes = ['praise', 'move', 'edit', 'correct'];
    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(', ')}` });
    }

    const result = policyManager.applyFeedback(type, data);
    console.log(`[Feedback] 📣 ${result.summary}`);

    // Git commit the policy update
    gitSync.fullSync(`정책 업데이트: ${result.summary}`).catch(() => {});

    res.json({ success: true, feedback: result });
});

// GET /api/git/log — Recent git history
app.get('/api/git/log', async (req, res) => {
    const log = await gitSync.getRecentLog(20);
    res.json(log);
});

// GET /api/stats — System statistics
app.get('/api/stats', (req, res) => {
    const graph = graphManager.readGraph();
    const policy = policyManager.readPolicy();

    res.json({
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        connectivity: graphManager.connectivityScore().toFixed(3),
        policyVersion: policy.version,
        totalFeedbacks: policy.totalFeedbacks,
        lastUpdated: graph.metadata?.lastUpdated || null,
        weights: policy.weights
    });
});

// GET /api/categories — List all discovered categories
app.get('/api/categories', (req, res) => {
    const categories = categorizer.discoverAllCategories();
    res.json(categories);
});

/**
 * ═══════════════════════════════════════════════════════
 *  FILE WATCHER (Chokidar)
 * ═══════════════════════════════════════════════════════
 */
function startWatcher() {
    const watcher = chokidar.watch(RAW_DIR, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,       // don't process existing files on startup
        awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100
        }
    });

    watcher.on('add', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ALL_EXTENSIONS.includes(ext)) {
            console.log(`[Watcher] 👀 New file detected: ${path.basename(filePath)}`);
            processingQueue.push(filePath);
            processQueue();
        }
    });

    watcher.on('change', (filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        if (ALL_EXTENSIONS.includes(ext)) {
            console.log(`[Watcher] 📝 File modified: ${path.basename(filePath)}`);
            processingQueue.push(filePath);
            processQueue();
        }
    });

    console.log(`[Watcher] 👁️  Monitoring: ${RAW_DIR}`);
}

/**
 * ═══════════════════════════════════════════════════════
 *  INITIALIZATION
 * ═══════════════════════════════════════════════════════
 */
async function init() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🧠  P-Reinforce Engine v1.0                            ║
║   The Autonomous Knowledge Gardener                      ║
║                                                          ║
║   "지식의 중력을 거스르는 엔진"                           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);

    // Ensure directory structure
    ensureDir(RAW_DIR);
    ensureDir(WIKI_DIR);
    ensureDir(META_DIR);
    categorizer.initializeCategoryFolders();

    // Initialize policy if not exists
    const policy = policyManager.readPolicy();
    if (!policy.lastUpdated) {
        policyManager.writePolicy(policyManager.DEFAULT_POLICY);
        console.log('[Init] 📋 Default policy created');
    }

    // Initialize graph if not exists
    const graph = graphManager.readGraph();
    if (!graph.nodes) {
        graphManager.saveGraph({ nodes: [], edges: [], metadata: {} });
        console.log('[Init] 🕸️  Empty graph created');
    }

    // Initialize Index
    updateIndex();

    // Initialize git
    await gitSync.initGit();

    // Start file watcher
    startWatcher();

    // Start Express server
    app.listen(PORT, () => {
        console.log(`[Server] 🌐 Dashboard: http://localhost:${PORT}`);
        console.log(`[Server] 📡 API:       http://localhost:${PORT}/api/graph`);
        console.log(`\n[Ready] ✨ Drop files into 00_Raw/ to begin!\n`);
    });
}

// ─── Launch ─────────────────────────────────────────────
init().catch(err => {
    console.error('[Fatal] ❌ Engine failed to start:', err);
    process.exit(1);
});
