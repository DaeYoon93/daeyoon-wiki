// engine/utils.js — P-Reinforce Utility Functions
// UUID generation, keyword extraction, cosine similarity, file helpers

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

/**
 * Generate a new UUID v4
 */
function generateUUID() {
    return uuidv4();
}

/**
 * Get today's date folder name in YYYY-MM-DD format
 */
function getDateFolder() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Sanitize a string for use as a filename
 */
function sanitizeFilename(str) {
    return str
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .trim()
        .substring(0, 100);
}

/**
 * Extract title from markdown content
 * Returns the first H1 heading or the first non-empty line
 */
function extractTitle(content) {
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const h1Match = line.match(/^#\s+(.+)/);
        if (h1Match) return h1Match[1].replace(/\[|\]/g, '').trim();
    }
    return lines[0] ? lines[0].substring(0, 80) : 'Untitled';
}

/**
 * Simple Korean/English stop words list
 */
const STOP_WORDS = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because',
    'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'they',
    'them', 'we', 'us', 'i', 'me', 'my', 'your', 'his', 'her', 'our',
    'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
    'if', 'then', 'else', 'about', 'up', 'out', 'off', 'over', 'under',
    // Korean particles & common functional words
    '이', '가', '은', '는', '을', '를', '의', '에', '에서', '로', '으로',
    '와', '과', '도', '만', '까지', '부터', '마다', '이다', '하다', '있다',
    '없다', '되다', '않다', '것', '수', '등', '및', '또는', '그', '이런',
    '저런', '그런', '때문', '위해', '대한', '통해', '따라', '관련'
]);

/**
 * Tokenize text into words (handles Korean + English mixed content)
 */
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Extract keywords using TF (term frequency) scoring
 * Returns an object { word: frequency, ... }
 */
function extractKeywords(text) {
    const tokens = tokenize(text);
    const freq = {};
    for (const token of tokens) {
        freq[token] = (freq[token] || 0) + 1;
    }

    // Normalize by total tokens
    const total = tokens.length || 1;
    const tf = {};
    for (const [word, count] of Object.entries(freq)) {
        tf[word] = count / total;
    }
    return tf;
}

/**
 * Compute cosine similarity between two keyword vectors
 * @param {Object} vecA - { word: weight, ... }
 * @param {Object} vecB - { word: weight, ... }
 * @returns {number} 0.0 ~ 1.0
 */
function cosineSimilarity(vecA, vecB) {
    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of allKeys) {
        const a = vecA[key] || 0;
        const b = vecB[key] || 0;
        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Get the current ISO timestamp
 */
function isoNow() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Recursively list all markdown files under a directory
 */
function listMarkdownFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...listMarkdownFiles(fullPath));
        } else if (entry.isFile() && /\.(md|txt)$/i.test(entry.name)) {
            results.push(fullPath);
        }
    }
    return results;
}

/**
 * Recursively list all subdirectories under a directory
 */
function listSubdirectories(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            results.push(fullPath);
            results.push(...listSubdirectories(fullPath));
        }
    }
    return results;
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Read a JSON file safely, returning a default on failure
 */
function readJsonSafe(filePath, defaultValue = {}) {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return defaultValue;
    }
}

/**
 * Write a JSON file with pretty formatting
 */
function writeJson(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
    ROOT_DIR,
    generateUUID,
    getDateFolder,
    sanitizeFilename,
    extractTitle,
    tokenize,
    extractKeywords,
    cosineSimilarity,
    isoNow,
    listMarkdownFiles,
    listSubdirectories,
    ensureDir,
    readJsonSafe,
    writeJson
};
