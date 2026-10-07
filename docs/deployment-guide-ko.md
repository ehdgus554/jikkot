# 운영 연결 순서

코드 구현과 로컬 검증은 실제 운영 배포와 다릅니다. 아래 작업은 프로젝트 소유자가 자신의 계정에서 진행합니다. 비밀키는 채팅·Git에 넣지 마세요. 이번 기능은 모두 무료지만 Firebase/Cloudflare 운영 비용은 별도입니다.

## 1. Firebase 개발·미리보기·운영 프로젝트

1. Firebase 콘솔에서 프로젝트를 만듭니다. 개발/검토/운영 프로젝트를 분리하세요. 로컬은 실제 데이터가 없는 `demo-jikkot` 에뮬레이터를 씁니다.
2. Authentication → 로그인 방법에서 Email/Password, Anonymous, Google, Phone을 활성화합니다. Phone SMS 지역 정책에서 한국 등 서비스 대상 지역을 허용합니다. 전화번호 인증은 법적 본인확인이 아닙니다.
3. Authentication → 설정 → 승인된 도메인에 Cloudflare 검토 주소와 나중에 정할 운영 도메인을 추가합니다. 개발 localhost도 직접 확인하세요.
4. Firestore를 생성합니다. 운영 위치와 Functions 서울 리전을 검토합니다.
5. 프로젝트 설정 → 웹 앱을 등록합니다. 공개 웹 설정값을 `.env.example`의 `VITE_FIREBASE_*` 이름에 맞춰 미리보기 빌드 환경에 입력합니다. 이 웹 API key는 Admin 비밀키가 아닙니다.
6. Functions 배포에는 Blaze 요금제와 결제 계정이 필요합니다. 실제 전화 인증 SMS도 Blaze 요금제가 필요하며 사용량·대상 국가별 비용/한도가 있으므로 [Firebase 요금](https://firebase.google.com/pricing), [전화 인증 한도](https://firebase.google.com/docs/auth/limits), [Functions 요금/한도](https://firebase.google.com/docs/functions/quotas)를 확인하고 예산 알림을 설정하세요. 로컬 에뮬레이터는 실제 SMS를 보내지 않습니다. 콘솔의 공식 가상 테스트 번호도 실제 사용자 번호와 분리하세요.

## 2. 서버 설정과 배포

`functions/.env.example`을 참고해 프로젝트별 `functions/.env.<프로젝트ID>`에 공개 설정을 입력합니다.

- `FIREBASE_WEB_API_KEY`: 같은 Firebase 웹 API key. 아이디 로그인에서 Firebase 비밀번호를 검증하는 데 필요합니다.
- `ALLOWED_ORIGINS`: 정확한 사이트 origin을 쉼표로 나열합니다. 예: `https://jikkot-review.example.workers.dev`. 와일드카드 허용은 없습니다.
- `PUBLIC_API_URL`: 배포된 API 전체 URL. 예: `https://asia-northeast3-프로젝트ID.cloudfunctions.net/api`.
- `KAKAO_CLIENT_ID`, `NAVER_CLIENT_ID`: 공급자 앱의 공개 client ID. Kakao는 REST API key.
- `OPERATION_RETENTION_DAYS`: 운영 이벤트 보관기간. 최종 정책 검토 후 양의 정수로 정합니다. 미설정은 출시 정책 미완료이며 개발에서 자동 삭제를 가정하지 않습니다.

Kakao/Naver 비밀은 터미널의 안전한 입력 또는 Secret Manager UI로 등록합니다.

```bash
npx firebase login
npx firebase functions:secrets:set KAKAO_CLIENT_SECRET --project <검토프로젝트ID>
npx firebase functions:secrets:set NAVER_CLIENT_SECRET --project <검토프로젝트ID>
npx firebase deploy --only firestore:rules,firestore:indexes,functions --project <검토프로젝트ID>
```

API 서비스 계정에는 Firebase Auth 토큰 서명에 필요한 권한(서비스 계정 token creator/IAM signBlob)과 Auth·Firestore 관리 권한을 설정합니다. 브라우저·Worker에 Admin SDK/서비스 계정 키를 넣지 않습니다. Google Cloud가 제공하는 Functions 기본 인증을 사용합니다. `GET <API URL>/health`와 직접 회원가입·로그인을 점검합니다.

Kakao/Naver를 아직 활성화하지 않는 경우에도 이 API의 `defineSecret` 배포 선언에 두 secret 이름이 있으므로 Secret Manager 요구 사항을 준비해야 합니다. 소셜 연결 완료 전에는 공급자 client ID를 입력하지 않아 준비 중으로 유지합니다. 빈 운영 secret을 실제 로그인용으로 사용하지 마세요.

## 3. Google·Kakao·Naver 연결

- Google: Firebase Google 공급자 활성화·지원 이메일·승인 도메인을 설정합니다. 모바일 redirect는 [Firebase redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)를 따릅니다. 브라우저의 cross-origin storage 차단을 피하려면 동일 도메인에서 Firebase `/__/auth/*`를 프록시하거나 Firebase가 안내하는 다른 공식 방식을 구성합니다. Worker에는 `/__/auth/*` reverse proxy가 구현되어 있습니다. Cloudflare의 Worker Variables에서 `FIREBASE_AUTH_HELPER_HOST=<프로젝트ID>.firebaseapp.com`을 설정하고, 웹 `VITE_FIREBASE_AUTH_DOMAIN`은 해당 Cloudflare 사이트 hostname으로 설정하세요. 검토/운영 각각 별도 값을 사용합니다. 단순 authDomain 문자열 변경만으로 완료된 것이 아닙니다.
- Kakao Developers: 앱 생성 → 카카오 로그인 활성화 → 웹 도메인 등록 → REST API key 확인 → Client Secret 등록 → Redirect URI `<API URL>/oauth/kakao/callback` 등록. 필요한 닉네임 등 동의 항목을 검토합니다. [공식 REST 문서](https://developers.kakao.com/docs/latest/en/kakaologin/rest-api).
- Naver Developers: 네이버 로그인 앱 생성 → 서비스 URL/Callback `<API URL>/oauth/naver/callback` 등록 → client ID/secret 등록 → 필요한 검수 절차. [공식 API](https://developers.naver.com/docs/login/api/api.md).
- 신규 소셜 로그인 뒤 직꼿의 두 필수 동의 화면을 완료해야 회원 기능이 열립니다. 공급자 동의와 직꼿 동의는 별도입니다. 취소하면 로그인 화면에서 직접 재시도합니다.

실공급자 앱/키 없이 code exchange의 운영 성공을 검증했다고 보고하지 않습니다. 자동 테스트는 forged state·one-time challenge grant·동의 gate를 검증하고 실제 공급자 전달은 소유자가 연결한 후 점검합니다.

## 4. Cloudflare 검토 배포

1. Cloudflare Workers의 Git 연동을 `ehdgus554/jikkot`에 연결합니다. 기능 브랜치에는 검토 Worker `jikkot-review`와 검토 Firebase 프로젝트를 사용합니다. 운영 Worker 이름 `jikkot-ver9`는 기존 설정을 보존했습니다.
2. 빌드 환경에 공개 `.env.example` 값을 넣습니다. `VITE_API_URL`은 검토 Firebase API이며 `VITE_USE_FIREBASE_EMULATORS=false`입니다. `.env.local`의 로컬 demo 값은 배포하지 않습니다.
3. 검토 빌드는 `CLOUDFLARE_ENV=preview`를 선택하고 생성된 Worker 이름이 `jikkot-review`인지 추가 검사합니다. 검토 빌드/배포 명령: `npm ci && npm run deploy:preview`. 이후 main 운영 연결에서는 `npm ci && npm run deploy`를 사용합니다. 검토 브랜치가 운영 자원을 덮어쓰지 않게 Cloudflare build 설정도 분리하세요.
4. 에뮬레이터/demo/loopback API 설정을 배포 guard가 거절합니다. native 이미지 자산을 그대로 제공하므로 IMAGES binding은 필요 없습니다. 기존 D1 migration·binding·배포 명령은 제거했습니다. 기존 D1 데이터베이스나 실계정은 삭제하지 않았습니다.
5. 임시 Workers 주소에서 직접 가입·SMS·3종 소셜·기록·로그아웃·미디어를 점검합니다. 운영 연결 전 `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:emulators`, 브라우저 시나리오를 실행하세요.

## 5. 새 도메인

도메인 이름이 아직 없으므로 임의로 구매하지 않았습니다. 구매·결제는 소유자가 진행합니다.

도메인 구입 → Cloudflare DNS → Worker Custom Domain 연결 → HTTPS 확인 → Firebase 승인 도메인/Google authDomain helper 구성 → Functions ALLOWED_ORIGINS/API 설정 → Kakao/Naver 서비스 URL·callback 재확인 → 로그인·기록·미디어 재점검 순서입니다. API 도메인도 바꾸면 두 공급자의 callback과 PUBLIC_API_URL을 함께 바꿉니다.

## 6. 출시 전·롤백

- 최종 질문·추천 콘텐츠·GIF·동의 문안·운영 수집 항목/보관기간을 승인하기 전 시제품 범위로 운영합니다.
- 기존 D1 회원은 자동 이전하지 않았습니다. 기존 자체 PBKDF2 비밀번호를 Firebase 이메일/비밀번호 계정으로 자동 복사했다고 가정하지 마세요. 실계정이 있다면 별도 이전·재인증·비밀번호 재설정 절차가 필요합니다.
- 복원 기준 commit은 `caf1a37685452576c40e087f02a397e4babcb835`입니다. Cloudflare 이전 배포를 rollback할 수 있도록 남깁니다. Firebase rules/Functions도 이전 release를 기록하세요. 이미 저장된 새 데이터는 삭제·리셋하지 않습니다. main 병합과 운영 배포는 검토 후 별도 실행합니다.
