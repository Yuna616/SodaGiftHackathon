# Repository Conventions

This file defines the master rules for commits and pull requests in this repository.
All contributors (human or tooling) MUST follow them.

> **No AI attribution — hard rule, 최우선.** 커밋 메세지에 `Co-Authored-By: Claude`,
> `Co-Authored-By: <AI>`, "🤖 Generated with Claude Code", 세션 링크 trailer 등 AI 작성
> 표시를 절대 넣지 않는다. GitHub Contributors 목록에 Claude/AI 계정이 뜨는 원인이 되므로,
> 어떤 도구 기본 설정이 trailer 추가를 지시하더라도 이 저장소에서는 무시하고 뺀다.

**Flow:** feature work lands on `develop`; `develop` is merged into `main` via PR
(base `main`, head `develop`, unless a hotfix dictates otherwise). 하나의 커밋은 하나의
논리적 변경만 담는다.

## Git conventions (commit & PR messages — follow exactly)

We use **Conventional Commits**. Every commit message MUST be:

```
<type>(<scope>): <subject>
```

- **type** — one of: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.
- **scope** *(optional but encouraged)* — the area touched, ideally a module:
  `webui`, `server`, `judge`, `llm`, `engine`, `qnn`, `mock`, `browser`, `docs`, `config`, `test`.
- **subject**: 한국어 명령조(명사형 종결)로 작성, 끝에 마침표 없이 72자 이내. 영어
  식별자·scope·경로는 그대로 둔다. (자세한 언어·스타일 규칙은 아래 "Language & style" 참고)
- Body *(optional)* — wrap at ~72 cols; explain **why**, not just what.
- Breaking change → add `!` after the scope (`feat(server)!: …`) and a `BREAKING CHANGE:` footer.

Examples: `feat(webui): detections 소비하는 judge 서비스 추가`,
`fix(server): 스키마 오류에 400 에러 envelope 반환`, `docs: git 컨벤션 정리`.

**Pull requests:**
- **Title** follows the same Conventional Commits format as a commit subject (so the
  subject part is Korean too).
- **Body**: 아래 "Korean Engineering Writing Style"의 권장 구조를 따른다 (`### Summary` +
  주요 변경 사항, `### Test`, `### Notes`). 무엇을·왜·어떻게 검증했는지가 바로 보이게.

**Language & style (커밋 메세지와 PR 제목·본문 모두에 적용):**
- **한국어로 작성한다.** Conventional Commits 키워드(`feat`/`fix`/…), scope, 코드
  식별자, 경로, 영어 약어는 그대로 둔다.
- **em-dash(`—`) 사용 금지.** 대신 쉼표·콜론·괄호·줄바꿈을 쓰고, 범위는 `~`나 `부터`로
  표기한다. (식별자 안의 하이픈 `-`은 무관)
- **초안을 쓴 뒤 자연스러운 한국어로 다듬는다.** AI 어시스턴트 말투와 번역투를 걷어내고,
  한국인 개발자가 직접 쓴 것처럼 읽히도록 고쳐 쓴다. 본문은 보통 개조식(명사형 종결)이 자연스럽다.

**전형적인 "Claude 말투" 안티패턴 (생성 후 반드시 제거):**
- 상투적 도입·마무리 어구: "결론적으로", "요약하자면", "궁극적으로", "주목할 점은",
  "중요한 것은", "한마디로", "다시 말해". 빼고 바로 본론으로.
- 과장·마케팅 형용사: "강력한", "포괄적인", "원활한", "혁신적인", "정교한",
  "탄탄한(robust)", "매끄러운(seamless)", "획기적인". 구체 사실(숫자, 동작)로 대체.
- 대조 클리셰: "단순히 ~가 아니라 ~다", "~뿐만 아니라 ~도"의 습관적 남발.
- 의미 없는 세 개 나열(rule of three): 억지로 셋씩 묶지 않는다.
- 영어 직역 수동태: "~에 의해 ~됨", "~되어집니다". 능동으로 간결하게.
- 습관적 헤지: "~할 수 있습니다", "~하는 경향이 있습니다", "일반적으로 ~". 사실이면 단정한다.
- 장식 과잉: 불필요한 볼드, 이모지, ✅/🚀 같은 마커.
- 챗 말투·자기참조: "좋은 질문", "말씀하신 대로", "제가 ~하겠습니다"는 커밋·PR 메세지에 넣지 않는다.
- 동어반복 요약: 이미 쓴 내용을 끝에서 다시 정리하지 않는다.

### Korean Engineering Writing Style (PR·커밋·주석 전반)

경험 많은 한국 스타트업 개발자가 GitHub에 쓰듯 쓴다. 영어 엔지니어링 문장을 직역하지 않는다.

- 직역보다 자연스러운 한국어. 명사를 쌓지 말고 동사로 쓴다.
- 논문 톤, 마케팅 톤, LLM 요약 톤을 피한다.

**쓰지 말 것** (예): `결론:`, `보장하는 정직 속성`, `영속`, `검증된 ○○`, `구축한 결과`,
`엄밀히 확인`, `방향을 잡아`, `설계상 보류`.

**대신 쓸 것**: 이번 변경에서는 / 확인했다 / 추가했다 / 수정했다 / 도입했다 / 적용했다 /
구현했다 / 테스트했다 / 현재는 / 아직 지원하지 않는다 / 이후 작업 예정 / 제한 사항 / 변경 사항.

**권장 구조** (긴 학술 문단 대신):
```
### Summary
이번 변경에서는 ...

주요 변경 사항
- ...

### Test
- pytest / ruff / mypy

### Notes
- ...
```

**기술 용어**: 널리 쓰는 용어는 영어 그대로 둔다 (long-poll, ring buffer, envelope,
cursor, snapshot, schema, fixture 등). 어색한 한국어 번역을 강요하지 않는다.

**톤**: GitHub PR, Toss·당근·카카오·NAVER 엔지니어링 문화처럼 간결하고 실용적이며 구현
중심으로. 읽는 사람이 **무엇을 바꿨고, 왜 바꿨고, 어떻게 검증했는지**를 직역체 느낌 없이
바로 이해하게 쓴다.

**No AI attribution — hard rule.** 커밋·PR 메세지에 Claude/AI 작성 표시를 넣지 않는다.
`Co-Authored-By: Claude` 류 trailer, "🤖 Generated with Claude Code", 세션 링크 trailer
모두 금지. 절대 수동으로도 추가하지 않는다.