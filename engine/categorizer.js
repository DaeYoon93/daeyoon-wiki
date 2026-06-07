// engine/categorizer.js — P-Reinforce Semantic Categorizer with RL Logic
// Analyzes raw input and decides where to place it in the wiki structure

const fs = require('fs');
const path = require('path');
const {
    ROOT_DIR,
    extractKeywords,
    cosineSimilarity,
    extractTitle,
    listMarkdownFiles,
    listSubdirectories,
    ensureDir,
    sanitizeFilename
} = require('./utils');
const graphManager = require('./graph-manager');
const policyManager = require('./policy-manager');

const WIKI_DIR = path.join(ROOT_DIR, '10_Wiki');

// Default top-level categories (emoji-prefixed as per spec)
const DEFAULT_CATEGORIES = [
    { name: '🛠️ Projects', description: '목표 중심 — 현재 진행 중인 일, 프로젝트별 요약', keywords: ['project', 'plan', 'goal', 'milestone', 'sprint', 'deadline', 'task', 'progress', '프로젝트', '목표', '계획', '진행', '일정', '마일스톤'] },
    { name: '💡 Topics', description: '개념 중심 — 심리학, 코딩, 철학 등 지식 분류', keywords: ['concept', 'theory', 'principle', 'research', 'study', 'analysis', 'framework', 'model', 'pattern', '개념', '이론', '원리', '연구', '분석', '패턴', '학습', '지식'] },
    { name: '⚖️ Decisions', description: '의사결정 중심 — 판단의 기록과 근거', keywords: ['decision', 'choice', 'trade-off', 'comparison', 'pros', 'cons', 'evaluate', 'criteria', 'judgment', '결정', '판단', '선택', '비교', '평가', '기준', '이유'] },
    { name: '🚀 Skills', description: '실행 중심 — 프롬프트, 워크플로우, 실전 패턴', keywords: ['skill', 'workflow', 'prompt', 'template', 'recipe', 'how-to', 'guide', 'tutorial', 'practice', 'tip', '스킬', '워크플로우', '프롬프트', '가이드', '방법', '팁', '실습'] }
];

/**
 * Ensure all default category folders exist
 */
function initializeCategoryFolders() {
    for (const cat of DEFAULT_CATEGORIES) {
        ensureDir(path.join(WIKI_DIR, cat.name));
    }
}

/**
 * Build a keyword vector for a category based on:
 * 1. Its default keywords
 * 2. Keywords from all documents already in that folder
 * 3. Policy boost adjustments
 */
function buildCategoryVector(categoryName) {
    const defaultCat = DEFAULT_CATEGORIES.find(c => c.name === categoryName);
    const baseKeywords = defaultCat ? defaultCat.keywords : [];

    // Start with base keywords
    const vec = {};
    for (const kw of baseKeywords) {
        vec[kw] = 0.3; // Base weight
    }

    // Add keywords from existing documents in this category
    const catDir = path.join(WIKI_DIR, categoryName);
    const files = listMarkdownFiles(catDir);

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const fileKeywords = extractKeywords(content);
            for (const [word, weight] of Object.entries(fileKeywords)) {
                vec[word] = (vec[word] || 0) + weight * 0.1; // Diminished contribution
            }
        } catch {
            // Skip unreadable files
        }
    }

    // Apply policy boost
    const boost = policyManager.getCategoryBoost(categoryName);
    for (const key of Object.keys(vec)) {
        vec[key] *= (1 + boost);
    }

    return vec;
}

/**
 * Scan the wiki for all existing subcategories (including user-created ones)
 */
function discoverAllCategories() {
    const categories = [];
    if (!fs.existsSync(WIKI_DIR)) return DEFAULT_CATEGORIES.map(c => c.name);

    const entries = fs.readdirSync(WIKI_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            categories.push(entry.name);
            // Also discover subcategories
            const subDir = path.join(WIKI_DIR, entry.name);
            const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
            for (const sub of subEntries) {
                if (sub.isDirectory()) {
                    categories.push(path.join(entry.name, sub.name));
                }
            }
        }
    }

    return categories;
}

/**
 * The core RL categorization function
 * Analyzes raw content and returns the best category placement
 *
 * @param {string} rawContent - The content to categorize
 * @returns {Object} {
 *   category: string,        // e.g. "💡 Topics"
 *   subcategory: string|null, // e.g. "Psychology" (if created)
 *   confidenceScore: number,  // 0.0 ~ 1.0
 *   isNewCategory: boolean,
 *   needsRefactoring: boolean,
 *   action: string            // Human-readable action summary
 * }
 */
function categorize(rawContent) {
    const contentVec = extractKeywords(rawContent);
    const title = extractTitle(rawContent);
    const allCategories = discoverAllCategories();
    const weights = policyManager.getWeights();

    // Score each category
    const scores = [];
    for (const catName of allCategories) {
        const catVec = buildCategoryVector(catName);
        const similarity = cosineSimilarity(contentVec, catVec);

        // Apply RL boost from policy
        const boost = policyManager.getCategoryBoost(catName);
        const adjustedSimilarity = Math.min(1.0, similarity + boost);

        scores.push({
            category: catName,
            similarity: adjustedSimilarity,
            rawSimilarity: similarity
        });
    }

    scores.sort((a, b) => b.similarity - a.similarity);

    const bestMatch = scores[0] || { category: '💡 Topics', similarity: 0, rawSimilarity: 0 };

    // Decision logic
    let result;

    if (bestMatch.similarity >= 0.85) {
        // High confidence — place in existing category
        result = {
            category: bestMatch.category,
            subcategory: null,
            confidenceScore: bestMatch.similarity,
            isNewCategory: false,
            needsRefactoring: false,
            action: `기존 폴더 배치: "${bestMatch.category}" (유사도 ${(bestMatch.similarity * 100).toFixed(1)}%)`
        };
    } else if (bestMatch.similarity >= 0.4) {
        // Medium confidence — place in best match but lower confidence
        result = {
            category: bestMatch.category,
            subcategory: null,
            confidenceScore: bestMatch.similarity,
            isNewCategory: false,
            needsRefactoring: false,
            action: `유사 폴더 배치: "${bestMatch.category}" (유사도 ${(bestMatch.similarity * 100).toFixed(1)}%)`
        };
    } else {
        // Low confidence — attempt to create a subcategory under best match
        // or place in Topics as a catch-all
        const parentCategory = bestMatch.category.split(path.sep)[0] || '💡 Topics';
        const subName = deriveSubcategoryName(rawContent, title);

        result = {
            category: parentCategory,
            subcategory: subName,
            confidenceScore: Math.max(0.3, bestMatch.similarity),
            isNewCategory: true,
            needsRefactoring: false,
            action: `신규 하위 폴더 생성: "${parentCategory}/${subName}"`
        };
    }

    // Check if refactoring is needed (folder > 12 files)
    const targetDir = path.join(WIKI_DIR, result.category);
    if (fs.existsSync(targetDir)) {
        const fileCount = listMarkdownFiles(targetDir).length;
        if (fileCount > 12) {
            result.needsRefactoring = true;
            result.action += ' ⚠️ 폴더 리팩토링 필요 (12개 파일 초과)';
        }
    }

    // Compute final reward score
    const graphConnectivity = graphManager.connectivityScore();
    result.rewardScore =
        weights.w1_categorization * result.confidenceScore +
        weights.w2_connectivity * graphConnectivity +
        weights.w3_satisfaction * 0.5; // Default satisfaction until feedback

    return result;
}

/**
 * Derive a subcategory name from content keywords
 */
function deriveSubcategoryName(content, title) {
    const keywords = extractKeywords(content);
    const topWords = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word);

    if (topWords.length > 0) {
        // Capitalize first letter
        const name = topWords[0].charAt(0).toUpperCase() + topWords[0].slice(1);
        return sanitizeFilename(name);
    }

    return sanitizeFilename(title.substring(0, 30));
}

module.exports = {
    categorize,
    initializeCategoryFolders,
    discoverAllCategories,
    DEFAULT_CATEGORIES
};
