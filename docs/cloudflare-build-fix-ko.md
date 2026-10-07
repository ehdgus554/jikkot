# Cloudflare 설치 실패 수정과 준비 화면 배포

2026-10-07 제공된 로그에서 `npm clean-install` 단계에 실패했습니다. 현재 GitHub `main` (`caf1a37`)의 `package-lock.json` 시작에 `Warning: truncated output ...`이 들어 있어 유효한 JSON이 아닙니다. Cloudflare가 코드를 빌드하기도 전에 종료한 원인입니다. 올바른 잠금파일은 PR #1의 `feat/service-flow-firebase` 브랜치에 있습니다. 이전 실패 빌드를 그대로 재시도하면 이전 main을 다시 받아 같은 오류가 발생합니다.

## 이번 배포 범위

사용자가 선택한 범위는 Firebase 미연결 **준비 화면** 배포입니다. Firebase 공개 설정이 전부 없으면 표준 `npm run build`도 준비 화면을 빌드합니다. `npm run build:preparation`으로 명시할 수도 있습니다. 준비 화면은 회원가입/로그인/추천/가짜 기록 버튼이 없고 Firebase Auth·Functions에 요청하지 않습니다. Firebase 키나 소셜 비밀, D1 바인딩 없이 웹을 먼저 배포할 수 있습니다.

Firebase 설정을 일부만 채운 상태는 정상 서비스로 배포하지 않습니다. `npm run deploy`의 설정 검사가 누락된 이름을 안내합니다. 추후 실제 서비스는 `.env.example`의 다섯 공개 설정을 모두 등록하고 `VITE_USE_FIREBASE_EMULATORS=false`로 다시 빌드합니다. 별도 서버/인증 설정은 [운영 연결 안내](deployment-guide-ko.md)를 따릅니다.

## Cloudflare에서 사용할 값

Workers & Pages → 연결된 Worker → Settings → Builds에서 확인합니다. Workers Git 빌드용 설정이며 Pages 정적 export로 전환하는 설정이 아닙니다.

| 항목 | 값 |
|---|---|
| 저장소 | `ehdgus554/jikkot` |
| 브랜치 | PR #1 반영 후 `main`, 또는 검토 중에는 `feat/service-flow-firebase` |
| 프로젝트 루트 | 저장소 루트 `/` (Cloudflare 내부 경로에 `/workspace/jikkot`을 입력하지 않음) |
| 빌드 명령 | `npm run build:preparation` |
| 배포 명령 | `npx wrangler deploy --config dist/server/wrangler.json` |
| Node | 기본 로그와 같은 24.18.0에서 검증 완료. 저장소 권장 버전은 22.23.3 |
| Firebase 환경변수 | 이번 준비 화면에는 필요 없음 |

`npm run deploy:preparation`은 설치 이후 검사·빌드·배포까지 한 번에 실행하는 대안입니다. 별도 빌드 명령이 이미 설정된 Cloudflare에서는 위 표처럼 빌드/배포를 분리하면 됩니다. 자동 의존성 설치는 `npm ci`를 그대로 사용합니다. `npm install`로 오류를 우회하거나 잠금파일을 삭제하지 않습니다.

GitHub check에서 실제 연결된 Cloudflare Worker 이름은 `jikkot`으로 확인됐습니다. Workers Builds가 제공하는 `WRANGLER_CI_OVERRIDE_NAME`을 Wrangler가 배포 시 적용하며 배포 대상 검사도 이를 확인합니다. 빌드 설정의 기존 기본 이름 `jikkot-ver9` 때문에 새 Worker를 만들 필요는 없습니다. 검토 전용 `jikkot-review` 환경을 수동으로 선택할 때는 다른 이름의 CI override를 거절합니다. 기존 운영 자원과 D1 데이터는 삭제하지 않습니다.

설정 저장 후 **수정 커밋을 사용하는 새 빌드**를 실행합니다. 이전 실패 커밋을 고정한 재시도가 아니라 최신 브랜치 빌드인지 확인하세요. 준비 화면에는 Firebase 연결이 없어도 ‘서비스 준비 중’ 문구가 표시됩니다.

## 검증

- 제공 로그와 동일한 Node 24.18.0 / npm 10.9.2를 별도 설치.
- `.env.local`, `node_modules`, 빌드 캐시가 없는 별도 체크아웃에서 `npm ci --progress=false` 성공.
- Firebase 환경변수 없이 `npm run deploy -- --dry-run` 성공: 콘텐츠 6,975개 검사 → 준비 화면 빌드 → Worker 이름/번들 검사 → Wrangler 업로드 패키징.
- 실제 로컬 workerd에서 360px/390px/1280px 준비 화면·새로고침·줄바꿈 확인. 인증/API 요청, 가짜 기능 버튼, 페이지 오류 없음.
- 준비 화면/부분 설정/정상 설정/demo 차단 테스트, 기존 서비스 회귀, 타입 검사·린트 통과.

수정 커밋 `37a71f0`을 push한 뒤 GitHub에 연동된 `Workers Builds: jikkot` 실제 preview 빌드가 `success`로 완료됐습니다 (build ID `097070ad-f58f-4e88-a51e-bcfa29fd2de2`). 사용자가 설정을 직접 다시 입력하지 않아도 기존 연결에서 수정 브랜치 빌드가 통과한 증거입니다.

Cloudflare dashboard 설정을 직접 변경하거나 운영 배포 버튼을 누르지는 않았습니다. preview 빌드 성공은 main 운영 배포 완료를 뜻하지 않습니다. main 병합과 운영 배포는 별도 단계입니다.
