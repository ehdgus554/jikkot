# Spark 인증·한도·저장 설계

2026-10-07부터 기본 구성은 Spark(Auth/Firestore)와 Cloudflare Workers입니다. 기존 Functions/SMS 구현은 참고 코드이며 현재 웹에서 사용하지 않습니다. 원본 서비스 플로우에서 사용자 요청으로 이메일 가입/로그인·메일 복구, Google 로그인으로 범위를 변경했습니다.

## 인증과 가입

비밀번호는 Firebase Auth SDK에서 직접 생성·검증합니다. Worker에 비밀번호를 전송하지 않습니다. 직접 로그인은 이메일/비밀번호이고 아이디·닉네임은 프로필 필드로 고유성을 검사합니다. 가입 실패 후 Firebase 계정만 남으면 같은 이메일로 로그인해서 가입을 마칠 수 있습니다. 활성 프로필 생성은 동의 버전·두 필수 동의·닉네임·아이디를 검증한 뒤 원자적으로 고유성 문서와 함께 저장합니다. Auth와 Firestore는 하나의 분산 transaction이 아닙니다.

Google은 popup/mobile redirect와 Firebase UID를 사용합니다. Google 신규 가입도 닉네임과 두 필수 동의를 저장해야 회원입니다. 프로필의 `authProvider`를 검사하며 다른 가입 방식으로 연결된 UID의 기록을 자동 승계하지 않습니다. 같은 이메일 문자열로 프로필을 찾아 합치지 않습니다. Kakao/Naver는 이번 구성에서 활성화하지 않습니다.

Worker는 Google JWK로 Firebase ID token의 RS256 서명·issuer·audience·만료·subject를 검증하고 Firebase accounts:lookup으로 사용자 비활성화와 세션 폐기를 검사합니다. unsigned emulator 토큰은 실제 Worker에서 거절합니다. 테스트용 검증기는 로컬 script에서만 주입하며 배포 번들에 포함하지 않습니다.

비밀번호 재설정은 Firebase 이메일 재설정 흐름입니다. SMS 인증·전화번호 수집·휴대폰 복구를 사용하지 않습니다. 재설정 화면은 이메일 등록 여부를 드러내지 않는 안내를 표시합니다.

## Firestore 서버 저장

Cloudflare runtime Secret의 전용 서비스 계정으로 짧은 OAuth 토큰을 발급하여 Firestore REST를 호출합니다. 키의 project/type/email을 검사하고 OAuth 요청 대상은 고정합니다. 전용 계정의 새 권한은 `roles/datastore.user`이며 Auth Admin·custom token 서명 권한은 필요 없습니다. 서버 키·access token·bearer·본문을 로그에 출력하지 않습니다.

Firestore REST atomic commit의 updateTime/exists 전제조건으로 모든 읽기 문서 버전을 검사하며 충돌하면 제한된 횟수로 다시 읽고 커밋합니다. 변경하지 않은 읽기도 전제조건을 포함해 동시 추천·가입·피드백 경쟁이 검사를 우회하지 못합니다. 추천/제출 UUID와 UID 소유권을 검사합니다. 피드백은 제출·운영·회원 기록을 동시에 저장하고 재시도는 중복을 만들지 않습니다. 기록 목록은 createdAt/name cursor로 페이지를 나눕니다.

비회원은 Anonymous Auth UID와 KST 날짜 기준 하루 한 번이며, 추천 저장 성공 때만 소비합니다. localStorage 삭제는 서버의 동일 UID 사용 기록을 없애지 않습니다. 익명 계정을 새로 생성하는 행위를 완전히 막는 본인 인증 한도는 아닙니다. 회원 기록과 운영 스냅샷은 구분합니다.

Firestore rules는 클라이언트 쓰기를 막고, 활성 프로필·UID·가입 공급자가 일치할 때만 자기 프로필/기록 읽기를 허용합니다. 서버 API는 같은 소유권을 검증합니다. 런타임 IAM 계정은 rules를 우회하므로 키 보호와 API 검증이 필수입니다.

## 웹 상태와 보조 방어

진행 localStorage는 owner/schema/content/expiry를 검증하고 비밀번호·인증 토큰을 저장하지 않습니다. 로그인과 로그아웃 때 개인 진행을 초기화하며 서버 기록은 유지합니다. 동의 없이 개인 기록을 복원하지 않습니다.

JSON 본문은 16 KiB로 제한하고 허용 origin을 검사합니다. Worker IP 제한은 인스턴스 단위 보조 방어입니다. 전역 제한이나 무료 플랜의 무제한 사용을 보장하지 않습니다. 동의 문안/보관 정책은 개발 초안이며 확정 전 검토가 필요합니다.
