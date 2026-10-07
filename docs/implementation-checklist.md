# 구현·검증 체크리스트

복원 기준: 대상 `ehdgus554/jikkot`의 `caf1a37685452576c40e087f02a397e4babcb835`. 작업 브랜치 `feat/service-flow-firebase`. 참고 `ehdgus554/jikkot-ver9/main`의 `aca2be21aabc03d952128ccb1bebb228613d91d5`. 2026-10-07 실제 Git 조회로 확인했습니다. 앱·추천 데이터는 동일했고 package/lockfile/tests/wrangler 설정이 달랐습니다. 참고 저장소는 `/tmp/jikkot-ver9-reference`에서 읽기만 했습니다.

| 요구 | 기존 상태 | 이번 구현·검증 | 외부/콘텐츠 대기 |
|---|---|---|---|
| 시작·비회원 동의 | 문진 바로 진입 | 초기 인증 확인, 동의 거절 차단, 브라우저 테스트 | 비의료 문안 최종 검토 |
| 아이디 직접 로그인 | D1 자체 비밀번호 | Functions private mapping + Firebase password proof + custom sign-in, 에뮬레이터 | Firebase 프로젝트·Email/Password 활성화 |
| 직접 가입 | 아이디/비밀번호만 | 이메일·닉네임, 중복 버튼/변경 해제, 전화 proof·두 동의, 원자적 예약/확정 및 보상 | SMS/지역 정책/개인정보 문안 |
| 소셜 | 미구현 | Google popup/mobile redirect, Kakao/Naver 공식 code/token/me, state cookie + one-time verifier grant, 신규 동의 gate | 공급자 등록/키/callback, 실계정 검증 |
| 복구 | 미구현 | 최근 phone sign-in proof + UID/phone mapping, 아이디 찾기·Firebase password update·세션 폐기 | 실제 SMS 전달 검증 |
| 문진 | 최근→습관, 최대2/없음 | 습관→최근, 복수/미선택 검증, 없음 제거 | 조건부 질문 콘텐츠 |
| 추천 | 3슬롯·상세 열기 소비 | route/습관 우선 회귀 검증, 단일 동작, unrelated fallback 제거 | 최종 연결 검수/GIF |
| 일일 한도 | 상세 API D1 unique | 문진 전 확인, KST server date, Firestore transaction + recommendation UUID, 동시 탭/재시도 검증 | 브라우저 식별 한계 고지 |
| 피드백 | 미구현 | 비회원 운영 저장·회원 즉시 개인 저장, submission UUID와 고정 재시도 | 운영 보관 정책 |
| 다음 추천 | 미구현 | 데이터 주입 가능한 분기, 빈 운영 콘텐츠는 완료 경로, fixture 서버 저장 테스트 | 관련 부위/악화 질문 연결표 |
| 기록 | 미구현 | UID별 snapshot, 부위별 날짜/답변/동작/피드백/변화, 소유권 rules/API 검증 | 없음 |
| 목록 | 로그인 후 기존 추천 복귀 | 최초 자세 필터, 직접 조회에는 완료/피드백 없음, 브라우저 검증 | 없음 |
| 로그인/로그아웃 | pending 승계 | 로그인 성공 답변 초기화·guest 데이터 미이전, 로그아웃 로컬 삭제/서버 유지 검증 | 없음 |
| 중단 복원 | 미구현 | schema/owner/content/expiry, 단계 저장, 추천/기록 reload, 자격 확인 후 복원 | 동일 브라우저만 지원 |
| 메뉴 | 기존 MVP | 기록/로그아웃/스트레칭/쇼핑, 준비 중 안내·닫기 | 출시 후 콘텐츠는 미활성화 |
| Cloudflare | D1 migration 배포 | D1 API/binding/deploy 의존 제거, native assets, 별도 preview Worker, emulator 배포 guard | Cloudflare 계정·임시 주소/도메인 |
| Firebase 권한 | 미구현 | rules, indexes, Functions UID/profile/input 검사, request throttling | 운영 Rules/Functions 배포 |

첨부 원문: `service-flow.md`, 구현 지시서: `implementation-request.md`. 실제 실행 결과는 `validation.md`에 기록합니다. 운영 배포와 실공급자 인증 성공은 별도입니다.
