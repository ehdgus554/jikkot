# 배포 안내: Firebase Spark + Cloudflare Workers

현재 운영 구성은 **Firebase Spark(Auth/Firestore) + Cloudflare Workers 무료 플랜**입니다. Blaze·Functions·SMS는 필요하지 않습니다. 기존 Functions 코드는 이전 구현 참고용으로 남아 있지만 현재 Worker는 호출하지 않습니다.

실제 계정 설정·명령은 [Spark 연결 안내](firebase-quick-connect-ko.md)를 따릅니다. 대상 프로젝트는 `jikkot`, 주소는 `https://jikkot.ehdgus554.workers.dev`입니다. 별도 도메인 구입은 필요 없습니다.

## 역할과 설정

- Firebase Auth: 이메일/비밀번호, Google, Anonymous. 비밀번호 재설정 이메일은 Firebase가 처리합니다.
- Firestore: 프로필·동의, 추천·피드백, 운영 스냅샷, UID별 개인 기록, 비회원 KST 하루 한도.
- Cloudflare Worker: 같은 사이트 `/api/*`에서 검증·추천·원자적 저장, `/__/auth/*` Google helper proxy, 웹/미디어 제공.
- 서버 권한: `FIREBASE_SERVICE_ACCOUNT`는 Cloudflare 암호화 Secret. 전용 계정에는 `roles/datastore.user`만 새로 부여합니다. 브라우저에 노출하거나 Git에 저장하지 않습니다.
- 공개 설정: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_URL=https://jikkot.ehdgus554.workers.dev/api`, `VITE_USE_FIREBASE_EMULATORS=false`.
- Worker 공개 vars: `FIREBASE_AUTH_HELPER_HOST=jikkot.firebaseapp.com`, `FIREBASE_PROJECT_ID`, `FIREBASE_WEB_API_KEY`, `ALLOWED_ORIGINS`. Project/key는 public production 빌드 설정에서도 읽을 수 있습니다. Helper는 프로젝트와 맞아야 합니다.

`npm run firebase:connect -- --project jikkot --site https://jikkot.ehdgus554.workers.dev --deploy --prepare-worker-key`는 로그인한 본인 Cloud Shell에서 실행합니다. 웹 앱/설정/IAM/rules/indexes만 준비하며 Functions 배포나 결제 계정 연결을 하지 않습니다.

## Cloudflare 배포

기존 Git 연결의 main을 사용합니다. 빌드 명령 `npm run build`, 배포 명령 `npx wrangler deploy --config dist/server/wrangler.json`. CI의 `WRANGLER_CI_OVERRIDE_NAME=jikkot` 대상 검사를 보존합니다. 공개 Firebase 설정이 모두 없으면 문진·추천 미리보기로 배포됩니다. 미리보기는 계정을 생성하거나 답변/피드백을 저장하지 않습니다. 일부만 넣은 설정·demo/emulator 설정은 표준 배포 guard가 거절합니다.

연결 후에는 `build:preparation`을 해제합니다. `config/firebase-web.json`은 공개 웹 설정 전용이며 서버 private key를 포함하면 안 됩니다. dev/test에서는 이 production 파일을 사용하지 않습니다.

Google 모바일 로그인은 Firebase 승인 도메인과 Google OAuth 승인 redirect URI `https://jikkot.ehdgus554.workers.dev/__/auth/handler`, 같은 도메인 helper가 모두 필요합니다. 새 custom domain을 연결하면 승인 도메인·redirect URI·authDomain·API origin/CORS를 함께 갱신합니다.

## 검증과 제한

`npm test`, `npm run typecheck`, `npm run lint`, `npm run test:emulators`, 브라우저 테스트를 사용합니다. 실제 `/api/health`와 이메일/Google 가입·로그인·재설정·기록을 별도로 확인합니다. 무료 플랜도 사용량 한도가 있으므로 무제한 운영을 보장하지 않습니다. IP 제한은 Worker 인스턴스 내 보조 방어이며 전역 보장은 아닙니다.

Cloudflare 이전 버전은 되돌릴 수 있도록 보존합니다. 기존 Firebase 자원/실데이터는 자동 삭제하지 않습니다. 계정 인증, Google 실제 redirect, 서버 Secret 설정이 끝나지 않았다면 연결 완료로 보고하지 않습니다.
