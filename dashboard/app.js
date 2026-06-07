// dashboard/app.js — P-Reinforce Dashboard Application
// D3 Knowledge Graph, API integration, document preview, feedback

document.addEventListener('DOMContentLoaded', () => {

    /* ═══════════════════════════════════════════════════════
       1. GLOBAL STATE
       ═══════════════════════════════════════════════════════ */
    let graphData = { nodes: [], edges: [] };
    let selectedNode = null;
    let simulation = null;

    const CATEGORY_COLORS = {
        '🛠️ Projects': '#f59e0b',
        '💡 Topics': '#6366f1',
        '⚖️ Decisions': '#8b5cf6',
        '🚀 Skills': '#10b981'
    };

    const CATEGORY_CLASSES = {
        '🛠️ Projects': 'projects',
        '💡 Topics': 'topics',
        '⚖️ Decisions': 'decisions',
        '🚀 Skills': 'skills'
    };

    /* ═══════════════════════════════════════════════════════
       2. API FETCH HELPERS
       ═══════════════════════════════════════════════════════ */
    async function fetchJSON(url) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error(`[API] Error fetching ${url}:`, err);
            return null;
        }
    }

    async function postJSON(url, body) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            return await resp.json();
        } catch (err) {
            console.error(`[API] Error posting ${url}:`, err);
            return null;
        }
    }

    /* ═══════════════════════════════════════════════════════
       3. DATA LOADING
       ═══════════════════════════════════════════════════════ */
    async function loadAllData() {
        const [graph, stats, gitLog] = await Promise.all([
            fetchJSON('/api/graph'),
            fetchJSON('/api/stats'),
            fetchJSON('/api/git/log')
        ]);

        if (graph) {
            graphData = graph;
            renderGraph();
            renderFolderTree();
        }

        if (stats) {
            updateStats(stats);
        }

        if (gitLog) {
            renderGitLog(gitLog);
        }

        updateEngineStatus(!!graph);
    }

    /* ═══════════════════════════════════════════════════════
       4. STATS UPDATE
       ═══════════════════════════════════════════════════════ */
    function updateStats(stats) {
        animateValue('statNodes', stats.totalNodes);
        animateValue('statEdges', stats.totalEdges);
        document.getElementById('statConnectivity').textContent =
            (parseFloat(stats.connectivity) * 100).toFixed(1) + '%';
        animateValue('statFeedbacks', stats.totalFeedbacks);
        document.getElementById('headerNodeCount').textContent = `${stats.totalNodes} nodes`;

        if (stats.lastUpdated) {
            const date = new Date(stats.lastUpdated);
            document.getElementById('lastCommitTime').textContent =
                date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        }
    }

    function animateValue(elementId, targetValue) {
        const el = document.getElementById(elementId);
        const current = parseInt(el.textContent) || 0;
        const diff = targetValue - current;
        const steps = 20;
        const stepValue = diff / steps;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            el.textContent = Math.round(current + stepValue * step);
            if (step >= steps) {
                el.textContent = targetValue;
                clearInterval(interval);
            }
        }, 30);
    }

    function updateEngineStatus(isOnline) {
        const dot = document.getElementById('engineStatus');
        const text = document.getElementById('engineStatusText');
        if (isOnline) {
            dot.className = 'status-dot';
            text.textContent = 'Engine Active';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Engine Offline';
        }
    }

    /* ═══════════════════════════════════════════════════════
       5. D3 KNOWLEDGE GRAPH
       ═══════════════════════════════════════════════════════ */
    function renderGraph() {
        const container = document.getElementById('graphCanvas');
        container.innerHTML = '';

        const width = container.clientWidth;
        const height = container.clientHeight || 420;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Background pattern (subtle grid)
        const defs = svg.append('defs');
        const pattern = defs.append('pattern')
            .attr('id', 'grid')
            .attr('width', 40)
            .attr('height', 40)
            .attr('patternUnits', 'userSpaceOnUse');
        pattern.append('circle')
            .attr('cx', 20).attr('cy', 20).attr('r', 0.5)
            .attr('fill', 'rgba(255,255,255,0.05)');

        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'url(#grid)');

        // Glow filter
        const filter = defs.append('filter').attr('id', 'glow');
        filter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        if (graphData.nodes.length === 0) {
            svg.append('text')
                .attr('x', width / 2)
                .attr('y', height / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', '#64748b')
                .attr('font-size', '14px')
                .attr('font-family', 'Inter, sans-serif')
                .text('00_Raw/ 폴더에 노트를 드롭하여 그래프를 시작하세요');
            return;
        }

        // Prepare data
        const nodes = graphData.nodes.map(n => ({ ...n }));
        const edges = graphData.edges
            .filter(e => {
                return nodes.some(n => n.id === e.source) && nodes.some(n => n.id === e.target);
            })
            .map(e => ({ ...e }));

        // Force simulation
        simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-200))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));

        // Draw edges
        const link = svg.append('g')
            .selectAll('line')
            .data(edges)
            .enter()
            .append('line')
            .attr('class', d => `link-line ${d.type || ''}`)
            .attr('stroke-opacity', 0.6);

        // Draw nodes
        const nodeGroup = svg.append('g')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .call(d3.drag()
                .on('start', dragStarted)
                .on('drag', dragged)
                .on('end', dragEnded));

        // Node circles
        nodeGroup.append('circle')
            .attr('class', 'node-circle')
            .attr('r', d => 6 + (d.confidenceScore || 0.5) * 10)
            .attr('fill', d => getCategoryColor(d.category))
            .attr('filter', 'url(#glow)')
            .on('click', (event, d) => selectNode(d))
            .on('mouseenter', function(event, d) {
                d3.select(this).transition().duration(200).attr('r', 8 + (d.confidenceScore || 0.5) * 10);
            })
            .on('mouseleave', function(event, d) {
                d3.select(this).transition().duration(200).attr('r', 6 + (d.confidenceScore || 0.5) * 10);
            });

        // Node labels
        nodeGroup.append('text')
            .attr('class', 'node-label')
            .attr('dy', d => -(10 + (d.confidenceScore || 0.5) * 10))
            .text(d => truncate(d.title, 20));

        // Tick handler
        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodeGroup.attr('transform', d => {
                d.x = Math.max(20, Math.min(width - 20, d.x));
                d.y = Math.max(20, Math.min(height - 20, d.y));
                return `translate(${d.x}, ${d.y})`;
            });
        });
    }

    function getCategoryColor(category) {
        if (!category) return '#6366f1';
        for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
            if (category.includes(key) || category.startsWith(key.substring(2))) {
                return color;
            }
        }
        // Check for known prefixes without emojis
        if (category.toLowerCase().includes('project')) return '#f59e0b';
        if (category.toLowerCase().includes('topic')) return '#6366f1';
        if (category.toLowerCase().includes('decision')) return '#8b5cf6';
        if (category.toLowerCase().includes('skill')) return '#10b981';
        return '#6366f1'; // Default indigo
    }

    function getCategoryClass(category) {
        if (!category) return 'topics';
        for (const [key, cls] of Object.entries(CATEGORY_CLASSES)) {
            if (category.includes(key)) return cls;
        }
        return 'topics';
    }

    // Drag handlers
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    /* ═══════════════════════════════════════════════════════
       6. FOLDER TREE
       ═══════════════════════════════════════════════════════ */
    function renderFolderTree() {
        const tree = document.getElementById('folderTree');

        // Group nodes by category
        const categories = {};
        for (const node of graphData.nodes) {
            const cat = node.category || 'Uncategorized';
            const topLevel = cat.split(/[\\/]/)[0];
            if (!categories[topLevel]) categories[topLevel] = [];
            categories[topLevel].push(node);
        }

        // Update total count
        document.getElementById('totalDocCount').textContent = graphData.nodes.length;

        // Clear existing dynamic items (keep the "all" item)
        const existing = tree.querySelectorAll('.folder-item.dynamic');
        existing.forEach(el => el.remove());
        const existingDocs = tree.querySelectorAll('.doc-list');
        existingDocs.forEach(el => el.remove());

        // Category icon mapping
        const catIcons = {
            '🛠️ Projects': '🛠️',
            '💡 Topics': '💡',
            '⚖️ Decisions': '⚖️',
            '🚀 Skills': '🚀'
        };

        const defaultCats = ['🛠️ Projects', '💡 Topics', '⚖️ Decisions', '🚀 Skills'];

        for (const catName of defaultCats) {
            const docs = categories[catName] || [];

            const li = document.createElement('li');
            li.className = 'folder-item dynamic';
            li.dataset.category = catName;
            li.innerHTML = `
                <span class="folder-icon">${catIcons[catName] || '📁'}</span>
                <span class="folder-name">${catName.replace(/^[^\s]+\s/, '')}</span>
                <span class="folder-count">${docs.length}</span>
            `;

            li.addEventListener('click', () => {
                document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                // Toggle doc list visibility
                const docList = li.nextElementSibling;
                if (docList && docList.classList.contains('doc-list')) {
                    docList.style.display = docList.style.display === 'none' ? 'block' : 'none';
                }
            });

            tree.appendChild(li);

            // Add document sub-items
            if (docs.length > 0) {
                const docUl = document.createElement('ul');
                docUl.className = 'doc-list';
                docUl.style.display = 'none';

                for (const doc of docs) {
                    const docLi = document.createElement('li');
                    docLi.className = 'doc-item';
                    docLi.textContent = truncate(doc.title, 30);
                    docLi.addEventListener('click', (e) => {
                        e.stopPropagation();
                        selectNode(doc);
                    });
                    docUl.appendChild(docLi);
                }

                tree.appendChild(docUl);
            }
        }

        // Show other custom categories
        for (const [catName, docs] of Object.entries(categories)) {
            if (defaultCats.includes(catName)) continue;

            const li = document.createElement('li');
            li.className = 'folder-item dynamic';
            li.innerHTML = `
                <span class="folder-icon">📁</span>
                <span class="folder-name">${catName}</span>
                <span class="folder-count">${docs.length}</span>
            `;
            li.addEventListener('click', () => {
                document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
            });
            tree.appendChild(li);
        }
    }

    /* ═══════════════════════════════════════════════════════
       7. DOCUMENT PREVIEW
       ═══════════════════════════════════════════════════════ */
    function selectNode(node) {
        selectedNode = node;

        const preview = document.getElementById('docPreview');
        const feedbackSection = document.getElementById('feedbackSection');

        const catClass = getCategoryClass(node.category);
        const catLabel = node.category || 'Uncategorized';
        const confidence = ((node.confidenceScore || 0.5) * 100).toFixed(0);
        const tagsHTML = (node.tags || []).map(t => `<span class="meta-tag">${t}</span>`).join('');

        preview.innerHTML = `
            <div class="doc-title">${escapeHtml(node.title)}</div>
            <div class="doc-category ${catClass}">${catLabel}</div>
            <div class="doc-meta">${tagsHTML}</div>
            <div class="doc-confidence">
                <div class="confidence-bar">
                    <div class="confidence-fill" style="width: ${confidence}%"></div>
                </div>
                <span class="confidence-label">${confidence}%</span>
            </div>
            <div class="doc-excerpt" id="docExcerpt">문서 내용을 불러오는 중...</div>
        `;

        feedbackSection.style.display = 'block';

        // Load document content
        loadDocContent(node.path);
    }

    async function loadDocContent(wikiPath) {
        const data = await fetchJSON(`/api/wiki/${wikiPath}`);
        const excerptEl = document.getElementById('docExcerpt');

        if (data && data.content) {
            // Extract the "한 줄 통찰" line
            const insightMatch = data.content.match(/> (.+)/);
            if (insightMatch) {
                excerptEl.textContent = insightMatch[1];
            } else {
                // Fallback: use first substantial line
                const lines = data.content.split('\n')
                    .filter(l => l.trim().length > 10 && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('>'));
                excerptEl.textContent = lines[0] || '(내용 없음)';
            }
        } else {
            excerptEl.textContent = '(문서를 불러올 수 없습니다)';
        }
    }

    /* ═══════════════════════════════════════════════════════
       8. GIT LOG
       ═══════════════════════════════════════════════════════ */
    function renderGitLog(log) {
        const list = document.getElementById('gitLogList');

        if (!log || log.length === 0) {
            list.innerHTML = '<li class="git-log-item"><span class="git-msg" style="color: var(--text-muted)">커밋 이력 없음</span></li>';
            return;
        }

        list.innerHTML = log.slice(0, 10).map(entry => {
            const msg = entry.message.replace('[P-Reinforce] ', '');
            const date = entry.date ? new Date(entry.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '';
            return `
                <li class="git-log-item">
                    <span class="git-hash">${entry.hash}</span>
                    <span class="git-msg">${escapeHtml(msg)}</span>
                    <span class="git-date">${date}</span>
                </li>
            `;
        }).join('');
    }

    /* ═══════════════════════════════════════════════════════
       9. FEEDBACK HANDLERS
       ═══════════════════════════════════════════════════════ */
    document.getElementById('btnPraise').addEventListener('click', async () => {
        if (!selectedNode) return;
        const result = await postJSON('/api/feedback', {
            type: 'praise',
            data: { category: selectedNode.category }
        });
        if (result && result.success) showToast('칭찬이 정책에 반영되었습니다 ✨');
    });

    document.getElementById('btnMove').addEventListener('click', async () => {
        if (!selectedNode) return;
        const target = prompt('이동할 카테고리를 입력하세요 (예: 🛠️ Projects):');
        if (!target) return;

        const result = await postJSON('/api/feedback', {
            type: 'move',
            data: {
                fromCategory: selectedNode.category,
                toCategory: target,
                documentTitle: selectedNode.title
            }
        });
        if (result && result.success) {
            showToast(`"${selectedNode.title}" → ${target} 이동 요청 반영 🔄`);
            await loadAllData();
        }
    });

    document.getElementById('btnCorrect').addEventListener('click', async () => {
        if (!selectedNode) return;
        const correction = prompt('어떤 점이 잘못되었나요?');
        if (!correction) return;

        const result = await postJSON('/api/feedback', {
            type: 'correct',
            data: {
                category: selectedNode.category,
                correction
            }
        });
        if (result && result.success) showToast('교정 피드백이 반영되었습니다 ⚠️');
    });

    document.getElementById('btnEdit').addEventListener('click', async () => {
        if (!selectedNode) return;
        const description = prompt('수정이 필요한 내용을 설명해 주세요:');
        if (!description) return;

        const result = await postJSON('/api/feedback', {
            type: 'edit',
            data: {
                category: selectedNode.category,
                description
            }
        });
        if (result && result.success) showToast('수정 피드백이 기록되었습니다 ✏️');
    });

    /* ═══════════════════════════════════════════════════════
       10. SEARCH
       ═══════════════════════════════════════════════════════ */
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const docItems = document.querySelectorAll('.doc-item');
        const folderItems = document.querySelectorAll('.folder-item.dynamic');

        if (query === '') {
            docItems.forEach(el => el.style.display = '');
            folderItems.forEach(el => el.style.display = '');
            document.querySelectorAll('.doc-list').forEach(el => el.style.display = 'none');
            return;
        }

        // Show all doc lists when searching
        document.querySelectorAll('.doc-list').forEach(el => el.style.display = 'block');

        docItems.forEach(el => {
            const text = el.textContent.toLowerCase();
            el.style.display = text.includes(query) ? '' : 'none';
        });
    });

    /* ═══════════════════════════════════════════════════════
       11. GRAPH CONTROLS
       ═══════════════════════════════════════════════════════ */
    document.getElementById('btnResetGraph').addEventListener('click', () => {
        if (simulation) {
            simulation.alpha(1).restart();
        }
    });

    document.getElementById('btnRefreshData').addEventListener('click', async () => {
        await loadAllData();
        showToast('데이터가 새로고침되었습니다 🔄');
    });

    /* ═══════════════════════════════════════════════════════
       12. UTILITIES
       ═══════════════════════════════════════════════════════ */
    function truncate(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message) {
        const toast = document.getElementById('toast');
        document.getElementById('toastMessage').textContent = message;
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 3500);
    }

    /* ═══════════════════════════════════════════════════════
       13. AUTO-REFRESH (Polling every 15s)
       ═══════════════════════════════════════════════════════ */
    setInterval(async () => {
        const stats = await fetchJSON('/api/stats');
        if (stats) {
            const currentNodes = parseInt(document.getElementById('statNodes').textContent) || 0;
            if (stats.totalNodes !== currentNodes) {
                // New data available, refresh everything
                await loadAllData();
            } else {
                updateStats(stats);
            }
            updateEngineStatus(true);
        } else {
            updateEngineStatus(false);
        }
    }, 15000);

    /* ═══════════════════════════════════════════════════════
       14. INITIALIZATION
       ═══════════════════════════════════════════════════════ */
    loadAllData();

});
