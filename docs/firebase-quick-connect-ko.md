# Firebase Spark 무료 연결

현재 대상은 Firebase 프로젝트 `jikkot`, 사이트 `https://jikkot.ehdgus554.workers.dev`입니다. **Blaze나 카드 등록 없이 Spark로 진행합니다.** Firebase Functions와 실제 SMS를 배포·사용하지 않습니다. 서버 API는 기존 Cloudflare Worker가 처리합니다. 무료 제공 한도를 초과하면 서비스가 제한될 수 있습니다.

## 1. 본인 Firebase 계정에서 할 설정

[jikkot 콘솔](https://console.firebase.google.com/project/jikkot/overview?hl=ko)에서 다음을 설정합니다.

1. Authentication 시작 → Email/Password, Google, Anonymous 활성화. Google 지원 이메일 선택. Phone은 필요 없습니다.
2. Authentication → Settings → 승인된 도메인에 `jikkot.ehdgus554.workers.dev` 추가.
3. Firestore Database 생성 → 위치 선택(서울 등), 보안 모드로 생성. 아래 도구가 서버 전용 쓰기 규칙을 배포합니다.
4. Google 모바일 redirect를 위해 [Google Cloud 사용자 인증 정보](https://console.cloud.google.com/apis/credentials?project=jikkot)의 Firebase용 웹 OAuth 클라이언트에 승인된 리디렉션 URI `https://jikkot.ehdgus554.workers.dev/__/auth/handler` 추가. 기존 Firebase URI는 보존합니다.

프로젝트는 이미 있으므로 새 프로젝트를 만들지 않습니다. Codex에는 Google/Cloudflare 로그인 세션이 없어 소유자의 콘솔 작업을 대신 실행할 수 없습니다. 채팅의 권한 허용만으로 계정 로그인이 제공되지는 않습니다.

## 2. Cloud Shell에서 연결 준비

[Cloud Shell에서 저장소 열기](https://shell.cloud.google.com/cloudshell/open?git_repo=https://github.com/ehdgus554/jikkot)를 누릅니다. 저장소 디렉터리에서 실행하세요. 예전에 받은 저장소라면 먼저 `git pull --ff-only`로 갱신합니다.

```bash
npm ci
npx firebase login --no-localhost
npm run firebase:connect -- --project jikkot --site https://jikkot.ehdgus554.workers.dev --deploy --prepare-worker-key
cat outputs/firebase-public-settings.json
```

Firebase 로그인은 본인 계정으로 해당 터미널에서 진행합니다. 인증 코드·로그인 토큰은 채팅에 보내지 않습니다.

도구는 웹 앱 등록/공개 SDK 설정 조회, Cloudflare 공개 연결값 준비, Firestore rules/indexes 배포를 처리합니다. `--deploy`는 **Functions를 배포하지 않습니다.** 전용 서비스 계정 `jikkot-api`에 `roles/datastore.user`만 부여합니다. Auth Admin·토큰 서명 권한을 새로 부여하지 않습니다.

`--prepare-worker-key`는 Worker가 Firestore 서버 API를 호출하는 키를 `outputs/firebase-worker-service-account.json`에 생성합니다. 기존 파일을 덮어쓰지 않고 파일 권한은 600으로 제한합니다. `.env*`와 `outputs`는 Git에서 제외됩니다. 키 생성이 조직 정책으로 금지되어 있으면 그 오류를 해결해야 하며, 권한 제한을 우회하지 않습니다. 과거 Functions 설정이 프로젝트에 존재해도 자동 삭제하지 않습니다.

## 3. Cloudflare에 서버 키 한 번 등록

[Cloudflare 대시보드](https://dash.cloudflare.com/) → Workers & Pages → **jikkot** → Settings → Variables and Secrets → Add:

- 이름: `FIREBASE_SERVICE_ACCOUNT`
- 종류: **Secret**
- 값: Cloud Shell의 `outputs/firebase-worker-service-account.json` 전체 내용

이 파일은 **채팅·Git·브라우저 빌드 변수에 넣지 않습니다.** Cloud Shell의 에디터에서 열어 Cloudflare의 Secret 입력칸으로 직접 복사하세요. Firebase 공개 웹 API key와 서버 private key는 서로 다릅니다. 서버 키는 런타임 Secret에만 사용합니다.

마지막 명령에서 출력한 **`outputs/firebase-public-settings.json`의 공개 JSON**은 Codex에 전달할 수 있습니다. Codex가 `config/firebase-web.json`과 필요한 공개 Worker 설정을 저장소에 반영하고 Cloudflare 자동배포를 확인합니다. 브라우저 public config가 모두 없으면 문진·추천 미리보기가 공개되며 로그인·서버 저장은 비활성입니다. 운영 환경변수가 있으면 그것이 우선하며 dev에서는 공개 production 파일을 사용하지 않습니다.

직접 설정할 경우 Cloudflare Builds Variables에 `outputs/firebase-cloudflare.env`의 공개 값 6개를 입력합니다. 빌드 명령은 `npm run build`, 배포 명령은 `npx wrangler deploy --config dist/server/wrangler.json`입니다. `build:preparation`은 연결 이후에는 사용하지 않습니다.

## 4. 완료 확인

`https://jikkot.ehdgus554.workers.dev/api/health`, 이메일 가입·로그인, Google 신규 동의, 이메일 재설정, 추천·피드백 저장, 계정별 기록·로그아웃을 실제 사이트에서 확인합니다. 로컬 에뮬레이터 검증과 실제 계정 연결 성공은 구분합니다. 키나 공급자 설정이 빠진 상태를 연결 완료라고 보고하지 않습니다.

이메일/Google의 이메일 문자열이 같더라도 서비스가 기록을 자동 병합하지 않습니다. 처음 가입한 로그인 방법과 다른 인증으로 같은 Firebase UID에 접속하면 안내 후 차단합니다. 신규 회원은 두 필수 동의와 고유 닉네임을 저장해야 이용할 수 있습니다. Kakao/Naver는 이번 Spark 구성이 지원하지 않아 준비 중으로 표시합니다.
