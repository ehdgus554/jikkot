# Spark 및 공개 미리보기 검증

2026-10-07, Node 22, Java 21, Firebase CLI 14.22.0, 실제 demo Auth/Firestore 에뮬레이터, 시스템 Chromium, Cloudflare local workerd에서 검증했습니다.

| 검사 | 결과 |
|---|---|
| typecheck / lint | 통과 |
| npm test | UI 7개 + 서비스 10개, 총 17개 통과. Firebase 설정이 없는 production 미리보기 빌드도 통과 |
| npm run test:emulators | 새로 시작한 Auth/Firestore에서 Spark API/rules/서명 검증 7개 통과, 종료 코드 0 |
| npm run test:browser | 연결된 demo API에서 360px·390px·데스크톱 6개씩 총 18개 통과. 이메일 가입·로그인·메일 복구·소유권별 기록·재시도·동의 gate 검증 |
| npm run test:public-preview | Firebase 설정 없는 production 번들을 local workerd에서 실행, 세 화면 크기에서 문진·추천·완료 확인. Auth/API 요청 0, 개인 진행 저장 없음, 로그인 버튼 비활성, JS 오류/넘침 없음 |
| npm run deploy -- --dry-run | 실제 jikkot CI override로 공개 미리보기 번들 업로드 사전 검증 통과 |
| Cloudflare 설치 조건 | Node 24/npm 10 별도 디렉터리의 lockfile 기반 npm ci --ignore-scripts 통과 |

Firestore REST는 atomic commit 전제조건으로 동시 가입/비회원 첫 추천 충돌을 검사하며, 피드백의 같은 UUID 재시도는 기록을 중복 생성하지 않았습니다. Google 프로필 동의 및 가입 공급자 변경 차단을 에뮬레이터에서 확인했습니다. 실제 서명된 JWT fixture로 issuer/audience/만료/폐기/비활성 계정 검사도 확인했습니다. unsigned emulator token은 production 검증기에서 거절했습니다.

이 결과는 실제 Google 사용자 계정·Cloudflare Secret·production Firestore 연결 성공을 의미하지 않습니다. 무료 계정 연결은 [Spark 설정 안내](firebase-quick-connect-ko.md)를 따릅니다. 공개 미리보기는 실제 회원/서버 저장을 대신하거나 가짜 회원 기록을 만들지 않습니다. 실제 추천 엔진을 브라우저 메모리에서 실행하고 reload 시 시작 화면으로 돌아갑니다.
