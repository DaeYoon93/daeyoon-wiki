// engine/git-sync.js — P-Reinforce Git Synchronization
// Automated staging, committing, and pushing to GitHub

const simpleGit = require('simple-git');
const path = require('path');
const { ROOT_DIR } = require('./utils');

const git = simpleGit(ROOT_DIR);

let isGitInitialized = false;

/**
 * Initialize git repo if not already initialized
 */
async function initGit() {
    try {
        const isRepo = await git.checkIsRepo();
        if (!isRepo) {
            await git.init();
            console.log('[Git] 🔧 Repository initialized');
        }
        isGitInitialized = true;

        // Check if remote exists
        const remotes = await git.getRemotes(true);
        if (remotes.length === 0) {
            console.log('[Git] ⚠️  No remote configured. Run: git remote add origin <url>');
        }
    } catch (err) {
        console.error('[Git] ❌ Init error:', err.message);
        isGitInitialized = false;
    }
}

/**
 * Stage all changes
 */
async function stage() {
    try {
        await git.add('.');
        return true;
    } catch (err) {
        console.error('[Git] ❌ Stage error:', err.message);
        return false;
    }
}

/**
 * Commit with a P-Reinforce prefixed message
 * @param {string} summary - Action summary
 * @returns {string|null} Commit hash or null on failure
 */
async function commit(summary) {
    try {
        const message = `[P-Reinforce] ${summary}`;
        const result = await git.commit(message, { '--allow-empty': null });

        const hash = result.commit || 'unknown';
        console.log(`[Git] ✅ Committed: ${hash.substring(0, 7)} — ${summary}`);
        return hash;
    } catch (err) {
        // "nothing to commit" is not an error for us
        if (err.message.includes('nothing to commit')) {
            console.log('[Git] ℹ️  Nothing to commit');
            return null;
        }
        console.error('[Git] ❌ Commit error:', err.message);
        return null;
    }
}

/**
 * Push to remote with retry logic
 * @param {number} maxRetries
 */
async function push(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const remotes = await git.getRemotes(true);
            if (remotes.length === 0) {
                console.log('[Git] ⚠️  No remote configured, skipping push');
                return false;
            }

            await git.push('origin', 'main');
            console.log('[Git] 🚀 Pushed to origin/main');
            return true;
        } catch (err) {
            console.error(`[Git] ❌ Push attempt ${attempt}/${maxRetries} failed:`, err.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    return false;
}

/**
 * Full sync cycle: stage → commit → push
 * @param {string} summary - Action description
 * @returns {string|null} Commit hash
 */
async function fullSync(summary) {
    if (!isGitInitialized) {
        await initGit();
    }

    const staged = await stage();
    if (!staged) return null;

    const hash = await commit(summary);
    if (!hash) return null;

    // Attempt push (non-blocking — failure doesn't break the pipeline)
    push().catch(err => {
        console.log('[Git] Push deferred:', err.message);
    });

    return hash;
}

/**
 * Get the latest commit hash
 */
async function getLatestHash() {
    try {
        const log = await git.log({ maxCount: 1 });
        return log.latest ? log.latest.hash : null;
    } catch {
        return null;
    }
}

/**
 * Get recent commit log
 */
async function getRecentLog(count = 10) {
    try {
        const log = await git.log({ maxCount: count });
        return log.all.map(entry => ({
            hash: entry.hash.substring(0, 7),
            message: entry.message,
            date: entry.date,
            author: entry.author_name
        }));
    } catch {
        return [];
    }
}

module.exports = {
    initGit,
    stage,
    commit,
    push,
    fullSync,
    getLatestHash,
    getRecentLog
};
