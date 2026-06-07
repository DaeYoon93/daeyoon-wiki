// engine/policy-manager.js — P-Reinforce RL Policy Manager
// Reads, writes, and updates the RL classification policy from user feedback

const fs = require('fs');
const path = require('path');
const { ROOT_DIR, isoNow } = require('./utils');

const POLICY_PATH = path.join(ROOT_DIR, '20_Meta', 'Policy.md');

/**
 * Default policy state
 */
const DEFAULT_POLICY = {
    weights: {
        w1_categorization: 0.5,
        w2_connectivity: 0.3,
        w3_satisfaction: 0.2
    },
    categoryBoundaries: {},  // { "Topics/Psychology": { boost: 0.1 }, ... }
    feedbackHistory: [],
    lastUpdated: null,
    totalFeedbacks: 0,
    version: 1
};

/**
 * Parse the Policy.md file to extract the JSON policy block
 */
function readPolicy() {
    try {
        if (!fs.existsSync(POLICY_PATH)) return { ...DEFAULT_POLICY };

        const content = fs.readFileSync(POLICY_PATH, 'utf-8');
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[1]);
        }
        return { ...DEFAULT_POLICY };
    } catch {
        return { ...DEFAULT_POLICY };
    }
}

/**
 * Write the policy back to Policy.md in a human-readable format
 */
function writePolicy(policy) {
    policy.lastUpdated = isoNow();
    policy.version = (policy.version || 0) + 1;

    const recentFeedback = policy.feedbackHistory.slice(-10);

    const content = `---
title: "P-Reinforce Classification Policy"
type: system
last_updated: "${policy.lastUpdated}"
version: ${policy.version}
---

# 🧠 P-Reinforce 분류 정책 (RL Policy)

> 이 문서는 P-Reinforce 엔진이 자동으로 관리합니다.
> 사용자 피드백에 따라 가중치와 경계선이 실시간으로 조정됩니다.

## 📊 보상 함수 가중치 (Reward Weights)

$$R = w_1(\\text{Categorization}) + w_2(\\text{Connectivity}) + w_3(\\text{Satisfaction})$$

| Weight | Name | Value |
|--------|------|-------|
| $w_1$ | Categorization Accuracy | **${policy.weights.w1_categorization.toFixed(3)}** |
| $w_2$ | Graph Connectivity | **${policy.weights.w2_connectivity.toFixed(3)}** |
| $w_3$ | User Satisfaction | **${policy.weights.w3_satisfaction.toFixed(3)}** |

## 🎯 카테고리 경계 조정 (Category Boundaries)

${Object.keys(policy.categoryBoundaries).length === 0
    ? '_아직 조정된 경계가 없습니다. 사용자 피드백을 기다리는 중..._'
    : Object.entries(policy.categoryBoundaries)
        .map(([cat, adj]) => `- **${cat}**: boost = ${adj.boost >= 0 ? '+' : ''}${adj.boost.toFixed(3)}`)
        .join('\n')
}

## 📝 최근 피드백 이력 (Recent Feedback)

${recentFeedback.length === 0
    ? '_피드백 이력 없음_'
    : recentFeedback.map(f =>
        `- \`${f.date}\` **${f.type}** — ${f.summary}`
    ).join('\n')
}

**총 누적 피드백**: ${policy.totalFeedbacks}회

## 🔧 Raw Policy Data

\`\`\`json
${JSON.stringify(policy, null, 2)}
\`\`\`
`;

    const dir = path.dirname(POLICY_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(POLICY_PATH, content, 'utf-8');
}

/**
 * Apply user feedback to the policy
 * @param {'praise'|'move'|'edit'|'correct'} type
 * @param {Object} data - Feedback payload
 *   - praise: { category }
 *   - move:   { fromCategory, toCategory, documentTitle }
 *   - edit:   { category, description }
 *   - correct:{ category, correction }
 */
function applyFeedback(type, data) {
    const policy = readPolicy();
    const LEARNING_RATE = 0.05;

    const feedbackEntry = {
        date: isoNow(),
        type,
        summary: '',
        data
    };

    switch (type) {
        case 'praise': {
            const cat = data.category;
            if (!policy.categoryBoundaries[cat]) {
                policy.categoryBoundaries[cat] = { boost: 0 };
            }
            policy.categoryBoundaries[cat].boost += LEARNING_RATE;
            // Boost satisfaction weight slightly
            policy.weights.w3_satisfaction = Math.min(0.4,
                policy.weights.w3_satisfaction + LEARNING_RATE * 0.1);
            feedbackEntry.summary = `"${cat}" 카테고리 분류 칭찬 → boost +${LEARNING_RATE}`;
            break;
        }

        case 'move': {
            const { fromCategory, toCategory, documentTitle } = data;
            // Penalize source category
            if (!policy.categoryBoundaries[fromCategory]) {
                policy.categoryBoundaries[fromCategory] = { boost: 0 };
            }
            policy.categoryBoundaries[fromCategory].boost -= LEARNING_RATE * 2;

            // Boost target category
            if (!policy.categoryBoundaries[toCategory]) {
                policy.categoryBoundaries[toCategory] = { boost: 0 };
            }
            policy.categoryBoundaries[toCategory].boost += LEARNING_RATE;

            feedbackEntry.summary = `"${documentTitle}" 이동: ${fromCategory} → ${toCategory}`;
            break;
        }

        case 'edit': {
            const { category, description } = data;
            feedbackEntry.summary = `"${category}" 문서 수정: ${description}`;
            break;
        }

        case 'correct': {
            const { category, correction } = data;
            if (!policy.categoryBoundaries[category]) {
                policy.categoryBoundaries[category] = { boost: 0 };
            }
            policy.categoryBoundaries[category].boost -= LEARNING_RATE;
            feedbackEntry.summary = `"${category}" 분류 교정: ${correction}`;
            break;
        }
    }

    // Renormalize weights so they sum to 1.0
    const wSum = policy.weights.w1_categorization
        + policy.weights.w2_connectivity
        + policy.weights.w3_satisfaction;
    policy.weights.w1_categorization /= wSum;
    policy.weights.w2_connectivity /= wSum;
    policy.weights.w3_satisfaction /= wSum;

    policy.feedbackHistory.push(feedbackEntry);
    policy.totalFeedbacks++;

    // Keep only last 100 feedback entries in memory
    if (policy.feedbackHistory.length > 100) {
        policy.feedbackHistory = policy.feedbackHistory.slice(-100);
    }

    writePolicy(policy);
    return feedbackEntry;
}

/**
 * Get the boost value for a given category path
 */
function getCategoryBoost(categoryPath) {
    const policy = readPolicy();
    const boundary = policy.categoryBoundaries[categoryPath];
    return boundary ? boundary.boost : 0;
}

/**
 * Get current reward weights
 */
function getWeights() {
    const policy = readPolicy();
    return policy.weights;
}

module.exports = {
    readPolicy,
    writePolicy,
    applyFeedback,
    getCategoryBoost,
    getWeights,
    DEFAULT_POLICY
};
