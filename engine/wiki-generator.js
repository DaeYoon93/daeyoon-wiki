// engine/wiki-generator.js — P-Reinforce Wiki Document Generator
// Transforms raw content into the Karpathy-style wiki template

const { generateUUID, isoNow, extractTitle, extractKeywords } = require('./utils');

/**
 * Generate a one-line insight (Karpathy Summary) from content
 * Uses the first meaningful sentence or a synthesized summary
 */
function generateOneLiner(content, title) {
    const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10 && !l.startsWith('#') && !l.startsWith('---'));

    if (lines.length > 0) {
        // Take the first substantial line, trim to ~120 chars
        let summary = lines[0];
        if (summary.length > 120) {
            summary = summary.substring(0, 117) + '...';
        }
        return summary;
    }
    return `${title}에 대한 핵심 지식`;
}

/**
 * Extract bullet-point patterns from content
 */
function extractPatterns(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const bullets = [];
    const patterns = [];

    for (const line of lines) {
        if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
            bullets.push(line);
        } else if (!line.startsWith('#') && !line.startsWith('---') && line.length > 20) {
            patterns.push(line);
        }
    }

    return { bullets, patterns };
}

/**
 * Generate a full wiki document from raw content
 * @param {Object} params
 * @param {string} params.rawContent - Original markdown content
 * @param {string} params.title - Document title
 * @param {string} params.categoryPath - e.g. "10_Wiki/💡 Topics/Psychology"
 * @param {number} params.confidenceScore - 0.0 ~ 1.0
 * @param {string[]} params.tags - Document tags
 * @param {string} params.rawSourcePath - Path to original raw file
 * @param {string} params.parentCategory - Parent category wiki link
 * @param {Object[]} params.relatedDocs - [{ title, path }, ...]
 * @param {string} [params.commitHash] - Git commit hash (injected after commit)
 * @returns {{ id: string, content: string }}
 */
function generateWikiDocument(params) {
    const {
        rawContent,
        title,
        categoryPath,
        confidenceScore,
        tags = [],
        rawSourcePath,
        parentCategory,
        relatedDocs = [],
        commitHash = 'pending'
    } = params;

    const id = generateUUID();
    const oneLiner = generateOneLiner(rawContent, title);
    const { bullets, patterns } = extractPatterns(rawContent);

    // Build the synthesized content section
    let synthesizedContent = '';

    if (patterns.length > 0) {
        synthesizedContent += '- **추출된 패턴:**\n';
        for (const p of patterns.slice(0, 5)) {
            synthesizedContent += `  - ${p}\n`;
        }
    }

    if (bullets.length > 0) {
        synthesizedContent += '- **세부 내용:**\n';
        for (const b of bullets.slice(0, 10)) {
            // Clean up the bullet prefix to standardize
            const clean = b.replace(/^[-*•]\s*/, '').trim();
            synthesizedContent += `  - ${clean}\n`;
        }
    }

    if (synthesizedContent === '') {
        // If no structured content was extractable, include the raw content body
        const bodyLines = rawContent.split('\n')
            .filter(l => !l.startsWith('#') && !l.startsWith('---') && l.trim().length > 0)
            .slice(0, 10);
        synthesizedContent = '- **원본 내용:**\n';
        for (const line of bodyLines) {
            synthesizedContent += `  - ${line.trim()}\n`;
        }
    }

    // Build related links (minimum 2)
    let relatedLinks = '';
    if (relatedDocs.length > 0) {
        relatedLinks = relatedDocs
            .slice(0, 5)
            .map(d => `[[${d.title}]]`)
            .join(', ');
    } else {
        relatedLinks = '_연결 대기 중..._';
    }

    // Build the parent link
    const parentLink = parentCategory ? `[[${parentCategory}]]` : `[[${categoryPath}]]`;

    const content = `---
id: "${id}"
category: "[[${categoryPath}]]"
confidence_score: ${confidenceScore.toFixed(2)}
tags: [${tags.map(t => `"${t}"`).join(', ')}]
last_reinforced: ${isoNow()}
github_commit: "${commitHash}"
---

# [[${title}]]

## 📌 한 줄 통찰 (The Karpathy Summary)
> ${oneLiner}

## 📖 구조화된 지식 (Synthesized Content)
${synthesizedContent}
## ⚠️ 모순 및 업데이트 (Contradictions & RL Update)
- **과거 데이터와의 충돌:** _초기 문서 — 아직 비교 대상 없음_
- **정책 변화:** confidence_score ${confidenceScore.toFixed(2)}로 초기 분류됨

## 🔗 지식 연결 (Graph)
- **Parent:** ${parentLink}
- **Related:** ${relatedLinks}
- **Raw Source:** [[${rawSourcePath}]]
`;

    return { id, content, title, tags };
}

/**
 * Auto-generate tags from content using keyword extraction
 */
function autoGenerateTags(content, maxTags = 5) {
    const keywords = extractKeywords(content);
    return Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxTags)
        .map(([word]) => word);
}

module.exports = {
    generateWikiDocument,
    autoGenerateTags,
    generateOneLiner,
    extractPatterns
};
