# 직꼿 서비스 플로우 시제품

Firebase 미연결 상태에서는 준비 화면을 먼저 배포할 수 있습니다. Cloudflare 설치 실패 로그의 원인과 버튼 재배포에 사용할 브랜치/명령은 [Cloudflare 배포 수정 안내](docs/cloudflare-build-fix-ko.md)를 확인하세요. 준비 화면 빌드는 `npm run build:preparation`, 전체 준비 화면 배포는 `npm run deploy:preparation`입니다. 공개 Firebase 설정이 모두 없으면 기본 빌드도 준비 화면을 사용합니다.

자세 → 불편 부위 → 생활 습관 → 최근 상태를 선택하고 동작 하나를 수행한 뒤 피드백을 남깁니다. Firebase Auth/Firestore/Functions가 인증과 데이터를 담당하고 Cloudflare Vinext Worker가 웹을 제공합니다. 기존 추천 콘텐츠는 검수 전 MVP이며 조건부 질문·관련 부위/악화 재추천표·GIF는 아직 확정되지 않았습니다. 회원 기능은 무료이고 스트레칭/쇼핑은 준비 중입니다.

## 로컬 실행

Node 22.13 이상(권장 22), Java 21 이상이 필요합니다.

```bash
npm ci
npm --prefix functions ci
cp .env.example .env.local
# .env.local에 다음 로컬 값 입력:
# VITE_FIREBASE_API_KEY=demo-key
# VITE_FIREBASE_AUTH_DOMAIN=demo-jikkot.firebaseapp.com
# VITE_FIREBASE_PROJECT_ID=demo-jikkot
# VITE_FIREBASE_APP_ID=demo-jikkot-app
# VITE_API_URL=http://127.0.0.1:5001/demo-jikkot/asia-northeast3/api
# VITE_USE_FIREBASE_EMULATORS=true
npm run emulators
```

다른 터미널에서 `npm run dev -- --port 5173 --strictPort`를 실행합니다. 에뮬레이터의 전화 인증 코드는 에뮬레이터 터미널/공식 테스트 API에서 확인합니다. 실제 SMS나 실사용 데이터는 사용하지 않습니다. Firebase 연결이 없으면 앱은 연결 준비 상태를 안내하며 가짜 회원/기록으로 대체하지 않습니다.

```bash
npm test                 # 콘텐츠 검사 + 빌드 + UI/추천/복원 회귀
npm run typecheck
npm run lint
npm run test:emulators   # 에뮬레이터를 새로 시작해 실제 Auth/Firestore/Functions/rules 검증
# 이미 에뮬레이터가 실행 중이면 npm run test:integration
# Vite와 에뮬레이터 실행 상태에서:
npx playwright install chromium
npm run test:browser
# 시스템 Chromium을 쓰는 환경: CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

`npm run build:local-worker`는 로컬 Worker 에뮬레이터 검증 전용 개발 빌드입니다. 운영/검토 배포는 별도 Firebase 환경변수를 설정하고 `npm run deploy:preview`/`npm run deploy`를 사용합니다. 배포 guard가 demo 프로젝트와 emulator/HTTP 설정을 거절합니다. 운영에 개발 빌드를 올리지 마세요.

로컬 Worker 자체 검증(에뮬레이터 실행 상태):

```bash
npm run build:local-worker
XDG_CONFIG_HOME=/tmp/jikkot-wrangler WRANGLER_SEND_METRICS=false npx wrangler dev --config dist/server/wrangler.json --port 8787 --local
# 다른 터미널:
CHROMIUM_PATH=/usr/bin/chromium npm run test:worker
# Wrangler 종료 후 배포용 번들 복원:
npm run build
```

## 문서

- [서비스 플로우 원문](docs/service-flow.md), [구현 지시서](docs/implementation-request.md)
- [요구사항별 구현·검증](docs/implementation-checklist.md)
- [콘텐츠 대기·추천 어댑터](docs/content-gaps.md)
- [인증·한도·저장 설계](docs/auth-design.md)
- [Firebase·소셜·SMS·Cloudflare·도메인 연결](docs/deployment-guide-ko.md)
- [실행 검증 결과](docs/validation.md)

D1 의존성은 새 앱에서 제거했지만 기존 Cloudflare 자원·실데이터는 삭제하지 않았습니다. 가입 동의 문안과 운영 보관 정책은 개발 초안이며 출시 전에 확정해야 합니다.
