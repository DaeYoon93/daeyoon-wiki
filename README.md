<p align="center">
  <img src="https://img.shields.io/badge/Engine-P--Reinforce%20v1.0-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeD0iNCIgeT0iMTgiIGZvbnQtc2l6ZT0iMTYiPvCfp6A8L3RleHQ+PC9zdmc+" alt="P-Reinforce"/>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/D3.js-v7-f9a03c?style=for-the-badge&logo=d3.js&logoColor=white" alt="D3.js"/>
  <img src="https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge" alt="License"/>
</p>

<h1 align="center">🧠 P-Reinforce</h1>
<h3 align="center">The Autonomous Knowledge Gardener</h3>
<p align="center"><i>"지식의 중력을 거스르는 엔진"</i></p>

<p align="center">
  Andrej Karpathy의 <b>LLM-Wiki</b> 아키텍처와 <b>강화학습(RL)</b> 이론을 결합한<br/>
  자율형 지식 관리 에이전트
</p>

---

## 📌 프로젝트 소개

**P-Reinforce**는 사용자가 던지는 파편화된 정보를 자동으로 읽어, 의미론적으로 분류하고, 지식 간 상호 연결을 수행하며, 모든 변화를 Git으로 버전 관리하는 **자율형 지식 자동화 에이전트**입니다.

> 💡 **핵심 철학**: 사용자는 생각의 조각을 `00_Raw/` 폴더에 던지기만 하면 됩니다.
> 나머지는 P-Reinforce가 알아서 분류하고, 정리하고, 연결하고, 커밋합니다.

### 왜 P-Reinforce인가?

| 기존 방식 | P-Reinforce |
|-----------|-------------|
| 📁 직접 폴더 정리 | 🤖 AI가 자동으로 최적의 위치에 배치 |
| 📝 수동으로 문서 포맷 작성 | 📋 Karpathy 위키 템플릿 자동 생성 |
| 🔗 연관 문서를 일일이 찾아 링크 | 🕸️ TF-IDF 유사도로 자동 `[[쌍방향 링크]]` 생성 |
| 💾 커밋을 잊거나 미루기 | 🔄 모든 변화를 실시간 자동 커밋+푸시 |
| 📊 지식 구조를 머릿속으로만 관리 | 🌐 D3.js 인터랙티브 지식 그래프로 시각화 |

---

## ✨ 핵심 기능

### 1. 🔍 실시간 파일 감시 (File Watcher)
- `00_Raw/` 폴더를 `chokidar`로 실시간 모니터링
- `.md`, `.txt`, `.json` 파일이 추가되면 즉시 파이프라인 가동
- 파일 쓰기 완료를 감지하는 안정성 검증 (stabilityThreshold: 1초)

### 2. 🧠 RL 기반 의미론적 분류 (Semantic Categorizer)
- **TF-IDF 키워드 추출** + **코사인 유사도** 기반 분류
- 한국어/영어 혼합 콘텐츠 지원 (이중 언어 스톱워드 사전)
- 강화학습 보상 함수에 따른 최적 배치:

$$R = w_1 \times \text{Categorization Accuracy} + w_2 \times \text{Graph Connectivity} + w_3 \times \text{User Satisfaction}$$

| 유사도 | 행동 |
|--------|------|
| ≥ 85% | 기존 폴더에 배치 (높은 확신) |
| 40~85% | 최적 폴더에 배치 (중간 확신) |
| < 40% | 새 하위 폴더 자동 생성 |
| 폴더 > 12개 파일 | 리팩토링 제안 |

### 3. 📝 Karpathy 위키 템플릿 자동 생성
모든 문서는 아래 구조로 변환됩니다:

```markdown
---
id: "UUID"
category: "[[10_Wiki/카테고리/경로]]"
confidence_score: 0.0 ~ 1.0
tags: ["태그1", "태그2"]
last_reinforced: 2026-06-07
github_commit: "abc1234"
---

# [[문서 제목]]

## 📌 한 줄 통찰 (The Karpathy Summary)
> 핵심을 꿰뚫는 단 한 문장

## 📖 구조화된 지식 (Synthesized Content)
- **추출된 패턴:** 반복 가능한 지혜
- **세부 내용:** 불렛포인트 정리

## ⚠️ 모순 및 업데이트 (Contradictions & RL Update)
- 과거 데이터와의 충돌 기록
- 정책 변화 설명

## 🔗 지식 연결 (Graph)
- **Parent:** [[상위_카테고리]]
- **Related:** [[연관_A]], [[연관_B]]
- **Raw Source:** [[00_Raw/원본_파일]]
```

### 4. 🕸️ 지식 그래프 (Knowledge Graph)
- `20_Meta/Graph.json`에 인접 리스트(Adjacency List) 형태로 저장
- 노드: 문서 (제목, 경로, 카테고리, 태그, confidence)
- 엣지: `related`, `parent`, `child`, `raw_source`, `contradicts`
- 연결성 점수(Connectivity Score) 계산으로 RL 보상 함수에 반영

### 5. 🔄 GitHub 자동 동기화
- 모든 변화를 자동으로 `git add . → commit → push`
- 커밋 메시지 형식: `[P-Reinforce] {Action_Summary}`
- 푸시 실패 시 최대 3회 재시도 (지수 백오프)
- 네트워크 장애가 파이프라인을 차단하지 않는 비동기 설계

### 6. 🎯 사용자 피드백 학습 (RL Policy)
사용자의 반응이 분류 정책을 실시간으로 개선합니다:

| 피드백 유형 | 행동 | 정책 변화 |
|-------------|------|-----------|
| **칭찬** 👍 | "이 분류 완벽해" | 해당 카테고리 가중치 ↑ |
| **이동** 🔄 | "코딩→비즈니스로 옮겨줘" | 경계선 재설정 (Boundary Shift) |
| **교정** ⚠️ | "이건 잘못 분류됐어" | 해당 카테고리 가중치 ↓ |
| **수정** ✏️ | "내용 수정 필요" | 수정 이력 기록 |
| **방치** 😶 | 구조를 계속 사용 | 암묵적 보상 → 정책 고착 |

### 7. 🌐 프리미엄 대시보드
- **D3.js 포스-다이렉티드 그래프**: 드래그, 호버, 클릭 인터랙션
- **폴더 트리 네비게이션**: 실시간 검색 필터링
- **문서 미리보기**: 태그, confidence 바, 핵심 인사이트 표시
- **Git 히스토리**: 최근 커밋 로그 실시간 표시
- **15초 간격 자동 새로고침**: 새 문서 감지 시 자동 업데이트
- **다크 테마**: 딥 네이비 + 인디고/바이올렛 악센트 + 글래스모피즘

---

## 🚀 시작하기

### 사전 요구사항

- **Node.js** 18 이상
- **Git** 설치 및 설정
- **GitHub** 저장소 (선택사항 — 자동 푸시를 위해)

### 설치

```bash
# 저장소 클론
git clone https://github.com/DaeYoon93/daeyoon-wiki.git
cd daeyoon-wiki

# 의존성 설치
npm install
```

### 실행

```bash
# 엔진 시작 (http://localhost:3000)
npm start

# 또는 개발 모드 (파일 변경 시 자동 재시작)
npm run dev
```

### 사용법

```bash
# 1. 아무 마크다운 파일을 00_Raw/ 폴더에 저장
echo "# 오늘의 학습 메모\n\n딥러닝의 역전파..." > 00_Raw/my-note.md

# 2. 터미널에서 파이프라인 동작 확인
# [Pipeline] 📥 Processing: my-note.md
# [Pipeline] 🧠 Category: 💡 Topics
# [Pipeline] ✅ Pipeline complete

# 3. 브라우저에서 결과 확인
# → http://localhost:3000
```

---

## 📂 폴더 구조

```
daeyoon-wiki/
│
├── 00_Raw/                     # 📥 [입력] 가공되지 않은 원본 데이터
│   └── YYYY-MM-DD/             #     날짜별 원본 보관 (Source of Truth)
│
├── 10_Wiki/                    # 🧠 [자동 구조화] RL 정책에 따라 관리되는 지식 층
│   ├── 🛠️ Projects/            #     목표 중심 (프로젝트, 일정, 마일스톤)
│   ├── 💡 Topics/              #     개념 중심 (심리학, 코딩, 철학 등)
│   ├── ⚖️ Decisions/           #     의사결정 중심 (왜 이렇게 판단했는가)
│   └── 🚀 Skills/              #     실행 중심 (프롬프트, 워크플로우, 팁)
│
├── 20_Meta/                    # ⚙️ [시스템] 지식 엔진의 두뇌 데이터
│   ├── Graph.json              #     지식 간 연결 관계 (시각화 + RL 보상)
│   ├── Policy.md               #     사용자 피드백 반영 분류 정책 (RL Weights)
│   └── Index.md                #     위키 전체 목차 (자동 생성)
│
├── dashboard/                  # 🌐 웹 대시보드
│   ├── index.html              #     3-컬럼 레이아웃 (사이드바/그래프/상세)
│   ├── style.css               #     프리미엄 다크 테마 + 글래스모피즘
│   └── app.js                  #     D3.js 그래프 + API 연동 + 피드백
│
├── engine/                     # 🔧 P-Reinforce 코어 엔진
│   ├── index.js                #     진입점: 파일 와처 + Express + 파이프라인
│   ├── categorizer.js          #     TF-IDF + 코사인 유사도 + RL 분류
│   ├── wiki-generator.js       #     Karpathy 위키 템플릿 생성기
│   ├── graph-manager.js        #     Graph.json CRUD + 연결성 점수
│   ├── git-sync.js             #     자동 stage/commit/push + 재시도
│   ├── policy-manager.js       #     RL 정책 읽기/쓰기/피드백 반영
│   └── utils.js                #     UUID, 키워드 추출, 유사도, 파일 헬퍼
│
├── package.json
├── .gitignore
└── README.md
```

---

## 📡 REST API

엔진이 실행되면 `http://localhost:3000`에서 아래 API를 사용할 수 있습니다.

### 데이터 조회

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/graph` | 전체 지식 그래프 | `{ nodes: [...], edges: [...], metadata: {...} }` |
| `GET` | `/api/wiki/{path}` | 위키 문서 조회 | `{ path: "...", content: "..." }` |
| `GET` | `/api/index` | 전체 목차 | `{ content: "..." }` |
| `GET` | `/api/policy` | 현재 RL 정책 | `{ weights: {...}, categoryBoundaries: {...}, ... }` |
| `GET` | `/api/stats` | 시스템 통계 | `{ totalNodes, totalEdges, connectivity, ... }` |
| `GET` | `/api/categories` | 발견된 카테고리 목록 | `["🛠️ Projects", "💡 Topics", ...]` |
| `GET` | `/api/git/log` | 최근 Git 커밋 로그 | `[{ hash, message, date }, ...]` |

### 피드백 제출

```bash
# 칭찬: 분류가 정확할 때
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "praise", "data": {"category": "💡 Topics"}}'

# 이동: 다른 폴더로 옮길 때
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "move", "data": {"fromCategory": "💡 Topics", "toCategory": "🛠️ Projects", "documentTitle": "문서 제목"}}'

# 교정: 분류가 잘못되었을 때
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "correct", "data": {"category": "💡 Topics", "correction": "이건 프로젝트입니다"}}'

# 수정: 내용 수정이 필요할 때
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"type": "edit", "data": {"category": "💡 Topics", "description": "참고 링크 추가 필요"}}'
```

---

## 🧪 처리 파이프라인

파일이 `00_Raw/`에 추가되면 아래 10단계 파이프라인이 순차 실행됩니다:

```
📥 파일 감지 (Chokidar)
   ↓
📝 원본 읽기 + 제목 추출
   ↓
🧠 RL 기반 카테고리 분류 (TF-IDF + 코사인 유사도 + 정책 보정)
   ↓
📂 대상 폴더 결정 (기존 배치 / 신규 생성)
   ↓
🔗 관련 문서 검색 (그래프 유사도 매칭)
   ↓
🏷️ 태그 자동 생성 (상위 5개 키워드)
   ↓
📋 Karpathy 위키 템플릿 생성 + 파일 저장
   ↓
🕸️ Graph.json 업데이트 (노드 + 엣지 추가)
   ↓
📚 Index.md 목차 재생성
   ↓
🔄 Git add → commit → push
```

---

## ⚙️ 기술 스택

| 기술 | 용도 | 버전 |
|------|------|------|
| **Node.js** | 런타임 | 18+ |
| **Express** | REST API 서버 | 4.21 |
| **Chokidar** | 파일 시스템 감시 | 3.6 |
| **simple-git** | Git 자동화 | 3.27 |
| **uuid** | 문서 고유 ID 생성 | 10.0 |
| **D3.js** | 지식 그래프 시각화 | 7.9 |
| **Font Awesome** | 아이콘 | 6.5 |
| **Inter / Outfit / Noto Sans KR** | 타이포그래피 | — |

---

## 🧠 강화학습 로직 상세

### 보상 함수 (Reward Function)

```
R = w₁ × Categorization + w₂ × Connectivity + w₃ × Satisfaction
```

| 가중치 | 초기값 | 설명 |
|--------|--------|------|
| w₁ (Categorization) | 0.500 | 분류 정확도 (코사인 유사도) |
| w₂ (Connectivity) | 0.300 | 그래프 연결성 (실제 엣지 / 이상적 엣지) |
| w₃ (Satisfaction) | 0.200 | 사용자 만족도 (피드백 기반) |

### 정책 업데이트 메커니즘

```
Learning Rate (α) = 0.05

칭찬 시:
  category.boost += α
  w₃ += α × 0.1

이동 시:
  source_category.boost -= α × 2  (페널티)
  target_category.boost += α      (보상)

교정 시:
  category.boost -= α             (페널티)

매 업데이트 후:
  w₁ + w₂ + w₃ = 1.0으로 재정규화
```

### 정책 파일 (`20_Meta/Policy.md`)

피드백이 누적될수록 정책 파일이 자동 업데이트되며, 다음 분류 시 반영됩니다.
최근 100건의 피드백 이력을 보관합니다.

---

## 🛤️ 로드맵

- [x] 코어 엔진 (파일 감시, 분류, 위키 생성)
- [x] 지식 그래프 (D3.js 시각화)
- [x] GitHub 자동 동기화
- [x] RL 피드백 루프
- [x] 프리미엄 웹 대시보드
- [ ] Ollama/LLM 연동으로 분류 정확도 향상
- [ ] 문서 간 자동 모순 감지 (Contradiction Detection)
- [ ] 폴더 자동 리팩토링 실행 (현재는 제안만)
- [ ] Obsidian 플러그인 연동
- [ ] 다국어 요약 생성

---

## 📄 라이선스

MIT License — 자유롭게 사용, 수정, 배포할 수 있습니다.

---

<p align="center">
  <i>Built with the philosophy: "지식의 중력을 거스르는 엔진"</i><br/>
  <b>P-Reinforce</b> — Your Autonomous Knowledge Gardener 🧠🌱
</p>
