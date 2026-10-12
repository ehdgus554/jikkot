# Firebase 연결 활성화 상태

기존 프로젝트 `jikkot`에 웹 앱 `1:252288368957:web:3feb53c831a22e60f34554`가 등록됐고, 사용자가 전달한 공개 SDK 설정을 검증했습니다. 새 프로젝트/요금제/도메인은 만들지 않았습니다.

- 브라우저 연결값: `config/firebase-web.json`. 전체 공개 VITE 설정이며 서버 비밀키를 포함하지 않습니다. 운영 빌드는 이 파일을 읽어 실제 Firebase 프로젝트를 연결합니다.
- 기존 Worker의 공개 변수: `wrangler.jsonc`에 project ID, 웹 API key, 기존 사이트 origin을 연결했습니다. 기존 Firebase auth helper와 Worker 대상은 유지합니다.
- 실제 인증 설정: 초기에는 HTTP 400 `CONFIGURATION_NOT_FOUND`였지만 사용자 설정 후 HTTP 200으로 정상 응답합니다. 기존 사이트 승인 도메인도 확인했습니다. 익명·이메일/비밀번호 공급자는 임시 인증 계정 생성/삭제가 각각 HTTP 200으로 통과했습니다.
- 사용자가 Cloud Shell의 `4/4 서버 키 준비 완료`와 Cloudflare 프로덕션의 `FIREBASE_SERVICE_ACCOUNT` Secret 등록을 확인했습니다. 이에 따라 공개 브라우저 설정을 활성화했습니다. Secret 값은 이 작업 환경이나 저장소에 전달되지 않았습니다.
- 실제 배포 성공과 운영 로그인·저장 확인은 별도 단계입니다. 설정 파일 활성화만으로 운영 연결 완료를 주장하지 않습니다.

## 계정에서 필요한 설정

현재 Codex 클라우드에는 Google Cloud CLI를 설치했으나 인증된 Google 계정은 없습니다. 별도 Firebase 앱 대화는 더 사용할 필요가 없습니다. [Cloud Shell 자동 설정](firebase-quick-connect-ko.md)의 한 줄 명령으로 IAM·Firestore·서버 키 준비를 진행합니다. 다음 인증 설정은 이미 실행된 항목을 보존합니다.

> 기존 프로젝트 jikkot의 Spark 무료 요금제를 유지하면서 Authentication을 시작하고 Email/Password, Google, Anonymous를 활성화해줘. 승인 도메인에 jikkot.ehdgus554.workers.dev를 추가해줘. 기존 Firestore 기본 데이터베이스가 없으면 서울 위치로 보안 모드에서 생성하고, 기존 데이터가 있으면 보존해줘. 실행할 수 없는 설정은 필요한 콘솔 화면과 이유를 알려줘. 새 프로젝트, Hosting, Storage, Functions, SMS, 유료 요금제를 추가하지 마. 비밀키나 인증 토큰을 채팅에 출력하지 마.

Google 로그인에는 기존 웹 OAuth 클라이언트의 승인 redirect URI `https://jikkot.ehdgus554.workers.dev/__/auth/handler`도 필요합니다. 기존 URI를 보존해야 합니다.

## 서버와 최종 활성화

서버는 기존 Firestore 서버 API 설계를 사용합니다. 전용 `jikkot-api@jikkot.iam.gserviceaccount.com`에 `roles/datastore.user`만 부여하고, 서비스 계정 JSON은 Cloudflare **jikkot → Settings → Variables and Secrets → FIREBASE_SERVICE_ACCOUNT → Secret**에 등록합니다. 사용자가 등록 완료를 확인했으며 이 JSON은 채팅이나 Git에 전달되지 않았습니다. 현재 도구에 Cloudflare 계정 접근이 제공되지 않아 Secret 내용을 직접 조회하지 않았습니다.

기존 서버 전용 Firestore rules/indexes와 계정 준비 도구는 [Spark 연결 안내](firebase-quick-connect-ko.md)에 있습니다. 로그인한 본인 Cloud Shell에서 `setup-spark-cloudshell.py --apply`가 필요한 IAM/규칙/키를 직접 준비합니다. Firebase CLI 재로그인은 필요 없습니다. Functions 배포와 결제 계정 연결은 하지 않습니다.

서버 설정과 Secret 등록 완료 확인을 받아 `config/firebase-web.json`을 활성화하고 빌드/배포합니다. Google redirect URI 등록은 실제 Google 로그인에서 별도로 확인해야 합니다. 현재 환경의 설정 조회·접근 제한과 실제 연결 완료는 구분하며, 운영 이메일/Google 가입·로그인·추천·피드백·기록이 확인되기 전에는 연결 완료로 보고하지 않습니다.
