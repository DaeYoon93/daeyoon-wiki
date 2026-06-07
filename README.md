# 🧠 P-Reinforce

**The Autonomous Knowledge Gardener**

P-Reinforce는 Andrej Karpathy의 LLM-Wiki 아키텍처와 강화학습(RL) 이론을 결합한 지식 자동화 에이전트입니다.

## ✨ 핵심 기능

| 기능 | 설명 |
|------|------|
| 📁 **자동 분류** | `00_Raw/`에 던진 파편을 의미론적으로 분석하여 최적의 폴더에 배치 |
| 🔗 **지식 연결** | 모든 문서를 `[[쌍방향 링크]]`로 엮어 거대한 외부 뇌 구축 |
| 📊 **지식 그래프** | D3.js 기반 인터랙티브 시각화 대시보드 |
| 🤖 **RL 정책** | 사용자 피드백(칭찬/수정/이동)을 학습하여 분류 정확도 자동 향상 |
| 🔄 **Git 동기화** | 모든 변화를 자동 커밋하여 지식의 타임라인 보존 |

## 🚀 시작하기

```bash
# 의존성 설치
npm install

# 엔진 시작 (http://localhost:3000)
npm start

# 개발 모드 (자동 재시작)
npm run dev
```

## 📂 폴더 구조

```
root/
├── 00_Raw/          # 가공되지 않은 원본 데이터 (여기에 노트를 던지세요!)
├── 10_Wiki/         # RL 정책에 따라 자동 구조화된 지식
│   ├── 🛠️ Projects/
│   ├── 💡 Topics/
│   ├── ⚖️ Decisions/
│   └── 🚀 Skills/
├── 20_Meta/         # 시스템 두뇌 데이터
│   ├── Graph.json
│   ├── Policy.md
│   └── Index.md
├── dashboard/       # 웹 대시보드
└── engine/          # P-Reinforce 코어 엔진
```

## 💡 에이전트 가르치기

- **칭찬**: "이 폴더 분류 완벽해" → 해당 주제의 가중치 ↑
- **수정**: "이건 '코딩'이 아니라 '비즈니스'로 옮겨줘" → 경계선 재설정
- **방치**: 구조를 계속 사용하면 → 암묵적 보상으로 정책 고착

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/graph` | 지식 그래프 데이터 |
| `GET` | `/api/wiki/:path` | 위키 문서 조회 |
| `GET` | `/api/index` | 전체 목차 (Index.md) |
| `GET` | `/api/policy` | 현재 RL 정책 |
| `POST` | `/api/feedback` | 사용자 피드백 제출 |

---

*Built with the philosophy: "지식의 중력을 거스르는 엔진"*
