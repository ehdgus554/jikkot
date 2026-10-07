# Firebase 연결을 위한 최소 계정 작업

지금 웹은 준비 화면이며 실제 Firebase 프로젝트에 연결되지 않았습니다. 채팅에서 작업 권한을 허용하는 것과 Google 계정 로그인은 별개입니다. 현재 Codex에는 Firebase/Cloudflare CLI 로그인 계정이 없어 실제 프로젝트 생성·결제 계정 연결·서버 배포를 실행할 수 없습니다. 비밀번호, 인증 코드, 서비스 계정 비밀키를 채팅에 붙이지 마세요.

## 1. 무료 접속 주소

Cloudflare Worker `jikkot` → Settings → Domains & Routes에서 `workers.dev` 주소를 확인합니다. 저장소에 `workers_dev: true`, `preview_urls: true`를 명시했습니다. 별도 도메인 구매는 필요 없습니다. 계정의 workers.dev subdomain을 아직 등록하지 않았다면 Cloudflare의 계정 설정에서 무료 subdomain을 한 번 등록해야 합니다. 실제 표시된 `https://jikkot.<계정-subdomain>.workers.dev` 주소를 사용하며 임의로 주소를 추측하지 않습니다.

## 2. 프로젝트 소유자가 할 최초 설정

이번 프로젝트는 이미 생성한 [jikkot](https://console.firebase.google.com/project/jikkot/overview?hl=ko)을 사용합니다. 새 프로젝트를 만들 필요가 없습니다.

실제 Functions와 SMS를 사용하려면 Blaze 결제 계정 연결이 필요합니다. 실제 비용과 카드 등록은 소유자가 콘솔에서 확인하고 진행합니다. 예산 알림을 설정하세요. 프로젝트 생성만으로 과금 서비스가 자동 연결되는 것은 아닙니다.

Authentication 시작 → Email/Password·Anonymous·Google·Phone 활성화 → Phone 허용 국가에 한국 등록 → 승인된 도메인에 실제 Worker hostname 추가 순서입니다. Firestore도 콘솔에서 생성하고 위치를 선택합니다(Functions는 서울 `asia-northeast3`). 소셜 신규 가입은 서비스 내 두 동의를 별도로 요구합니다.

## 3. 연결 도구

Google 계정에 로그인한 [Cloud Shell에서 저장소 열기](https://shell.cloud.google.com/cloudshell/open?git_repo=https://github.com/ehdgus554/jikkot)를 사용하거나 아래처럼 저장소를 받습니다. 프로젝트 ID와 주소는 실제 값을 사용합니다. 로그인 인증 코드는 해당 터미널에만 입력하며 채팅으로 전달하지 않습니다.

```bash
git clone https://github.com/ehdgus554/jikkot.git
cd jikkot
npm ci
npx firebase login --no-localhost
npm run firebase:connect -- --project jikkot --site https://jikkot.ehdgus554.workers.dev --deploy
cat outputs/firebase-public-settings.json
```

도구는 프로젝트의 기존 웹 앱을 사용하거나 없으면 웹 앱 하나를 등록하고 공식 SDK config를 조회합니다. 웹 앱이 여러 개면 `--app <앱ID>`를 지정합니다. 다음을 준비합니다.

- `.env.production.local`: 실제 Firebase 웹 연결값, production emulator false.
- `functions/.env.<프로젝트ID>`: 웹 API key, 정확한 CORS origin, 서울 Functions API URL. 관련 없는 기존 설정은 보존합니다.
- `wrangler.jsonc`의 `FIREBASE_AUTH_HELPER_HOST`: Google 모바일 redirect의 같은 도메인 helper 대상.
- `outputs/firebase-cloudflare.env`: Cloudflare의 빌드 변수에 등록할 공개 설정 6개.
- `outputs/firebase-public-settings.json`: 공개 웹 설정만 있는 파일. 실제 서버 배포를 확인한 뒤 이 내용을 `config/firebase-web.json`으로 저장해 Git에 반영하면 Cloudflare 계정의 빌드 변수를 따로 입력하지 않아도 표준 production 빌드에서 사용합니다. 명시한 환경변수가 있으면 그 값이 우선이고 dev/test에서는 이 공개 production 설정을 사용하지 않습니다. Admin 비밀키는 이 파일에 넣지 않습니다.
- `--deploy`가 있으면 Cloud Shell의 로그인 계정으로 프로젝트 안에 전용 `jikkot-api` 런타임 서비스 계정을 준비합니다. Auth 관리·Firestore 데이터 접근·자기 토큰 서명 권한과 배포자의 해당 계정 사용 권한만 지정하고, Functions 의존성 설치 후 rules/indexes/Functions를 배포합니다. 결제 계정이나 IAM 권한이 없으면 실제 오류로 중단하며 성공으로 표시하지 않습니다.

SDK config는 공개 브라우저 설정입니다. Admin/서비스 계정 키는 사용하거나 출력하지 않습니다. 프로젝트/HTTPS origin 검증 전에 파일을 작성하지 않으며 테스트용 demo 프로젝트, 서로 다른 project/authDomain, 환경변수 줄바꿈 주입을 거절합니다. 도구가 수정한 `wrangler.jsonc`의 공개 helper 설정은 검토 후 Git에 반영합니다. 개인 `.env` 파일과 `outputs`는 Git에서 제외됩니다.

서버 배포가 성공하면 마지막 명령에서 출력한 공개 JSON만 Codex에 전달할 수 있습니다. Codex가 실제 API 응답을 확인하고 공개 production 설정을 저장소에 반영해 Cloudflare 자동배포를 진행합니다. 로그인 인증 코드나 서비스 계정 JSON은 전달하지 않습니다.

## 4. Cloudflare 활성화

Worker → Settings → Builds → Variables에 `outputs/firebase-cloudflare.env`의 공개 설정을 등록합니다. 빌드 명령은 **`npm run build`**입니다. `npm run build:preparation`을 유지하면 키를 연결해도 준비 화면이 유지됩니다. 배포 명령은 `npx wrangler deploy --config dist/server/wrangler.json`입니다.

Google 로그인의 모바일 redirect에는 같은 도메인 `/__/auth/*` proxy 외에 Google OAuth client의 Authorized redirect URIs에 `https://<실제-Worker-hostname>/__/auth/handler`도 등록합니다. Firebase 승인 도메인·서버 CORS·web authDomain·helper가 같은 사이트에 맞아야 합니다.

Kakao/Naver는 client ID가 설정되지 않으면 Secret Manager 선언과 배포 바인딩에서 제외됩니다. 처음 Email/Password·Google·Phone을 연결할 때 Kakao/Naver 비밀키를 먼저 만들 필요가 없습니다. 두 공급자는 별도 등록/검수/키 설정 후 추가합니다.

## 5. 완료 확인

실제 API `/health`, 가입 SMS, 직접 로그인, Google 로그인, 추천·피드백 저장, UID별 기록, 로그아웃을 확인합니다. 그 전에는 연결 완료라고 보고하지 않습니다. 이번 로컬 검증은 연결 설정 검사·컴파일·에뮬레이터 범위이며 실제 Google 계정/Blaze/SMS 연동은 아직 실행되지 않았습니다.

이 작업에서 확인한 프로젝트 ID는 `jikkot`, 사이트는 `https://jikkot.ehdgus554.workers.dev`입니다. 계정 인증은 실제 본인 계정에서 필요하며 Codex에 로그인된 Google 계정이 있다고 가정하지 않습니다.
