---
title: "P-Reinforce Classification Policy"
type: system
last_updated: "2026-06-07"
version: 2
---

# 🧠 P-Reinforce 분류 정책 (RL Policy)

> 이 문서는 P-Reinforce 엔진이 자동으로 관리합니다.
> 사용자 피드백에 따라 가중치와 경계선이 실시간으로 조정됩니다.

## 📊 보상 함수 가중치 (Reward Weights)

$$R = w_1(\text{Categorization}) + w_2(\text{Connectivity}) + w_3(\text{Satisfaction})$$

| Weight | Name | Value |
|--------|------|-------|
| $w_1$ | Categorization Accuracy | **0.500** |
| $w_2$ | Graph Connectivity | **0.300** |
| $w_3$ | User Satisfaction | **0.200** |

## 🎯 카테고리 경계 조정 (Category Boundaries)

_아직 조정된 경계가 없습니다. 사용자 피드백을 기다리는 중..._

## 📝 최근 피드백 이력 (Recent Feedback)

_피드백 이력 없음_

**총 누적 피드백**: 0회

## 🔧 Raw Policy Data

```json
{
  "weights": {
    "w1_categorization": 0.5,
    "w2_connectivity": 0.3,
    "w3_satisfaction": 0.2
  },
  "categoryBoundaries": {},
  "feedbackHistory": [],
  "lastUpdated": "2026-06-07",
  "totalFeedbacks": 0,
  "version": 2
}
```
