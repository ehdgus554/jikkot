# 직꼿

일상에서 불편한 곳에 맞는 2–3개 동작 루틴, 운동 전 8종목 몸풀기, 여유롭게 몸풀기 24개 구성을 제공하는 웹앱입니다. 홈의 주 진입은 ‘불편한 곳 풀기’ 하나이며, 두 묶음 기능은 몸풀기 탭의 회원 기능입니다.

2026-10-19 질문·추천 패치와 `2026-10-19.2` 콘텐츠를 반영했습니다. 등록 94개 중 O09는 새 추천에서 제외하고 과거 기록·이미지를 보존합니다. 공개 연결은 daily 70 / warmup 16 / leisure 63개입니다. 일상은 자세·그림 부위·습관·최근 행동 네 화면으로 끝내며, 30개 기본 셀과 과거 반응으로 추천합니다. 운동 전은 종목에서 바로 서기·비누움 바닥 동작을 섞은 순서로 이동합니다. 여유 모드의 자세·지지 정책은 별도입니다. 정지 그림과 단계·실시량을 제공하며 타이머는 수행을 자동 완료하지 않습니다.

운영 주소: https://jikkot.ehdgus554.workers.dev

구현·보관·검증·배포 확인 방법은 [이번 패치 인수 문서](docs/patch-2026-10-19.md), 콘텐츠 범위는 [콘텐츠 안내](docs/content-gaps.md)를 확인하세요. 이전 날짜의 문서는 당시 구현·실행의 이력이며 이번 출시의 승인 범위와 테스트 결과를 대신하지 않습니다.

## 구성

Firebase Spark Authentication/Firestore와 기존 Cloudflare Vinext Worker를 사용합니다. 이메일/비밀번호와 Google 가입 모두 본인이 정한 2–20글자 닉네임과 세 가지 별도 동의가 필요합니다. 새 가입에는 username을 요구하지 않습니다. 닉네임이 없는 기존 계정은 기록을 유지하고 보완 입력을 받습니다.

비회원 이용 횟수·기록은 이용일 다음 00:00 KST에 만료됩니다. 서버가 조회·복원·반응을 차단하고 기존 Worker의 10분 주기 작업이 실제 삭제와 재시도를 처리합니다. 회원 기록은 직접 삭제·동의 철회·탈퇴까지 보관합니다. 외부 AI와 성장 기능은 기본 비활성입니다. Functions·SMS·새 유료 인프라는 추가하지 않았습니다.

## 로컬 실행과 검증

Node 22.13 이상, Java 21 이상이 필요합니다.

```bash
npm ci
cp .env.example .env.development.local
```

로컬 파일에 `VITE_FIREBASE_API_KEY=demo-key`, `VITE_FIREBASE_AUTH_DOMAIN=demo-jikkot.firebaseapp.com`, `VITE_FIREBASE_PROJECT_ID=demo-jikkot`, `VITE_FIREBASE_APP_ID=demo-jikkot-app`, `VITE_API_URL=http://127.0.0.1:5002/api`, `VITE_USE_FIREBASE_EMULATORS=true`를 설정합니다. 각각 별도 터미널에서 실행합니다.

```bash
npm run emulators
npm run dev:api
npm run dev -- --port 5173
```

```bash
npm test
npm run typecheck
npm run lint
npm run test:spark
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

브라우저 검사는 실제 로컬 Auth/Firestore 에뮬레이터와 API를 사용하며 다섯 화면 크기에서 실행합니다. Google 검사는 에뮬레이터 자격 증명을 사용합니다. 실제 계정의 Google OAuth 팝업·모바일 기기 검사를 대신하지 않습니다.

## 운영 배포

기존 GitHub `main` → Cloudflare `Workers Builds: jikkot` 연결을 사용합니다. 빌드는 `npm run build`, 게시 명령은 `npx wrangler deploy --config dist/server/wrangler.json`입니다. CI 성공뿐 아니라 운영 버전 100% 적용, 새 자산 해시, 실제 인증·저장·기록 재조회와 삭제 작업 시각을 확인합니다. 서버 키는 기존 `FIREBASE_SERVICE_ACCOUNT` Secret을 사용하고 저장소에 포함하지 않습니다.
