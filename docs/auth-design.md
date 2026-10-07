# 인증·저장 설계

## 아이디 로그인

두 선택을 비교했습니다. 전체 커스텀 비밀번호 저장 방식은 해시·복구·세션 검증을 별도 운영해야 합니다. Firebase 이메일/비밀번호 검증을 서버에서 호출하는 방식은 Firebase가 비밀번호를 관리하면서 사용자 화면의 **아이디 로그인**을 유지합니다. 후자를 선택했습니다.

서버 전용 usernames(hash) → UID → Auth email 조회 후 Identity Toolkit `signInWithPassword`에 비밀번호를 전달하고, 반환 UID를 확인한 뒤 custom token을 발급합니다. 매핑은 공개하지 않습니다. 이메일은 가입 정보이며 로그인 화면은 아이디를 받습니다. 요청 본문/비밀번호/문자 코드/토큰은 로그에 출력하지 않습니다. 인증·조회·복구·OAuth에 서버 Firestore 요청 제한을 적용합니다. 운영 IP 정책은 프록시 환경에 맞게 검토해야 합니다.

가입: 최근 5분 내 전화 인증 토큰의 phone_number와 sign_in_provider=phone을 확인 → 아이디/닉네임/전화번호 예약 transaction → 같은 전화 Auth UID에 이메일·비밀번호 연결 → 프로필·동의·유일성 mapping을 atomic finalize. 최종 서버가 모든 값과 동의를 다시 확인합니다. 충돌은 다른 계정으로 자동 합치지 않습니다. 예약은 15분 만료/TTL이고 확정 문서에서는 만료 필드를 제거합니다. 실패하면 이번 시도의 미확정 예약만 지우고 비밀번호 자격을 해제하여 확인된 전화 계정으로 재시도할 수 있게 합니다. Auth와 Firestore의 완전한 분산 transaction은 없으며, 중간 종료 후 같은 전화번호로 재인증/재가입하여 복구합니다. 완료 응답 손실은 같은 UID/가입 정보로 재시도할 수 있습니다.

복구는 전화번호 입력을 신뢰하지 않습니다. 최근 phone sign-in proof, phoneOwners 매핑, 프로필 phone hash, 동일 UID를 모두 확인합니다. 직접 가입 계정만 복구하며 password 변경은 Firebase Auth에서 수행하고 refresh token을 폐기합니다. 이메일 reset을 휴대폰 복구로 대체하지 않습니다.

## 소셜

Google은 Firebase Auth SDK popup/모바일 redirect를 사용하고 Functions가 검증된 Google provider subject를 별도의 `google_<hash>` 서비스 UID로 교환합니다. Firebase가 내부적으로 같은 Google 이메일을 password Auth UID에 연결하더라도 원래 회원 프로필·기록은 승계하지 않습니다. raw Google 토큰은 서비스 API와 기록 rules에서 거절하고 canonical custom token만 사용합니다. 서비스 계정의 자동 이메일 병합을 방지하는 경계입니다. 모바일 redirect는 Firebase 공식 redirect best practices에 따라 authDomain과 `/__/auth` helper 경로 설정이 필요합니다. Cloudflare 사이트에서 서로 다른 authDomain의 저장소 차단이 발생하면 별도 문서의 동일 도메인 auth helper proxy 방법을 적용해야 합니다. 설정 없이 실단말 동작을 보장하지 않습니다.

Kakao/Naver는 Firebase 기본 공급자가 아니므로 Functions가 authorization code를 공급자에 교환하고 공식 user/me 응답의 subject로 UID를 정합니다. 브라우저 입력 provider ID를 신뢰하지 않습니다. state는 서버 저장·10분 TTL·HTTP-only SameSite=Lax 쿠키와 바인딩하며 callback에서 단 한 번 소비합니다. 사용자 취소는 프론트 로그인 화면으로 돌아갑니다. URL에 Firebase 토큰을 넣지 않고 60초짜리 one-time grant를 넣습니다. 원래 브라우저 sessionStorage verifier의 SHA-256 challenge를 확인한 뒤 custom token을 반환합니다. Google/Kakao/Naver 신규 계정은 두 동의가 저장되기 전 active 회원이 아닙니다.

같은 이메일이라는 이유로 직접/소셜 계정을 합치지 않습니다. 직접 가입 닉네임은 중복 확인한 이름이며, 소셜 닉네임은 공급자 표시 이름과 UID hash suffix로 원자적 예약하여 중복을 피합니다. 이번 화면에는 계정 연결 메뉴가 없습니다. 향후 연결은 양쪽 계정의 최근 인증 증명이 있어야 합니다. Kakao/Naver UID는 provider+subject hash로 안정화하며 로그인 가능 계정과 별개입니다.

## 권한·데이터

- profiles 및 profiles/{UID}/records: active 본인만 읽기. 쓰기는 서버만.
- usernames/nicknames/phoneOwners: 비공개 매핑.
- recommendations/submissions/operations/guestDays/guestConsents: 서버만 읽기·쓰기. API가 매번 UID·회원 active·소유자 종류를 검증합니다.
- 비회원은 Firebase anonymous UID로 브라우저를 식별합니다. 회원 UID와 데이터를 병합하지 않습니다. 저장소/쿠키 삭제·다른 브라우저·기기까지 같은 사람이라고 보장하지 않습니다.
- 추천 snapshot은 선택 ID·당시 문구·패턴·동작·콘텐츠 버전을 포함합니다. 회원 기록은 매 피드백마다 transaction으로 운영 이벤트와 함께 저장합니다. 목록 직접 조회는 수행 기록을 생성하지 않습니다.
- 일일 소비는 서버 transaction이 추천 snapshot과 guestDays를 함께 저장한 뒤 화면에 표시합니다. DOM 표시와 DB commit을 완전히 원자적으로 만들 수 없습니다. 응답 손실/화면 종료 때도 같은 추천 UUID를 로컬에 미리 저장하여 기존 결과를 재조회합니다. commit 후 실제 표시 전에 닫았을 때는 소비된 추천을 복원합니다. 원자적 표시를 보장한다고 주장하지 않습니다.
- 진행 상태는 별도 schema/owner/content/expiry를 가진 localStorage입니다. Firebase SDK의 로그인 유지와 구분합니다. 앱 진행에는 인증 토큰·비밀번호·SMS 코드가 없습니다. 인증이 확인되기 전 개인 화면을 복원하지 않습니다.

동의·운영 보관 정책은 `lib/service/policy.ts`와 Functions 환경 설정에 분리합니다. 개발 문안은 최종 법률·운영 정책이 아닙니다. guest에게 추가 개인정보 필수 체크를 만들지 않았습니다.

로컬 Firebase CLI는 14.22.0으로 고정했습니다. 15.32.1의 강제 ProxyAgent는 NO_PROXY를 무시해 Firestore rules 변경 시 localhost 요청이 프록시로 나가 인증 에뮬레이터까지 종료되었습니다. 14.22.0의 proxy-agent는 NO_PROXY를 존중합니다. 외부 프록시·TLS·다운로드 검증은 유지합니다.
