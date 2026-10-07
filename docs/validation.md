# 실제 실행 검증 (2026-10-07)

대상은 `ehdgus554/jikkot`, 작업 브랜치는 `feat/service-flow-firebase`입니다. `jikkot-ver9`는 읽기 전용 참고로만 사용했습니다. 첨부 구현 지시서 558줄을 끝까지 읽고, 포함된 서비스 플로우 원문이 별도 첨부 플로우와 일치함을 확인했습니다.

환경: Node 22.23.3, Java 21, npm 11.9.0, Firebase CLI 14.22.0, Firestore emulator 1.19.8, 시스템 Chromium, Wrangler 4.92.0. 실제 사용자/운영 데이터 대신 `demo-jikkot` Auth·Firestore·Functions 에뮬레이터를 사용했습니다.

| 실행 | 결과와 범위 |
|---|---|
| 재사용 install script | Node 설치, 루트/Functions `npm ci`, Functions 빌드, Firestore emulator 준비, 콘텐츠 검사 성공. 기존 `.env.local`은 보존하며 없을 때만 로컬 demo 설정 생성 |
| `npm run content:check` | 6,975개 비어 있지 않은 다중 선택·자세·부위 조합, route 후보/자세 적합성/확장 연결 검사 성공 |
| `npm test` | production 빌드 성공, UI/번들 회귀 7개 + 서비스 단위 5개 성공. 300개 대표 입력의 기존 첫 슬롯 순위 보존, KST 자정, 사용자/스키마/기한/콘텐츠 복원 검증 포함 |
| `npm run typecheck` | 루트 TypeScript 및 Functions 컴파일 성공 |
| `npm run lint` | ESLint 성공 |
| `npm run test:integration` | 7개 성공. 실제 Auth·Firestore·Functions와 rules 사용: 동시 첫 추천 경쟁, 고정 UUID 재시도, 회원 피드백 즉시 기록, 중복 가입 경쟁, 동의 gate, UID 소유권, OAuth state/grant, 서버 확장 fixture, Google 식별자 분리 검증 |
| 전화 복구 | 다른 전화 proof/custom token 거절, 본인 새 phone proof로 아이디 확인·비밀번호 갱신, 이전 비밀번호 거절, 새 로그인 성공·개인 기록 유지 검증 |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser` | 360px·390px·데스크톱에서 6개씩 총 18개 성공. 동의 거절, 문진 순서·다중 선택, 추천 reload, 로그인 초기화, 부위별 기록, 목록 조회, 로그아웃 후 서버 기록 유지, 중복 입력 변경, 키보드, 실제 emulator SMS 가입/복구, 소셜 취소·준비 중 안내 검증 |
| 저장 응답 유실 브라우저 검사 | 서버 추천 commit 후 응답을 끊어도 reload·동일 추천 ID 재시도로 복원. 피드백 응답 실패·reload 뒤 고정 submission ID 재시도 검증 |
| 모바일 시각 확인 후 재검사 | 360px 로그인 캡처에서 소셜 버튼 문구 겹침을 수정. 세로 버튼 배치·제목/폼 간격 적용 후 관련 6개 브라우저 검사 재통과, 버튼 텍스트 내부 overflow 0개 |
| `npm run build:local-worker` + local Wrangler + `npm run test:worker` | 실제 local workerd에서 비회원 Auth → Functions 추천/피드백 저장, `/assets/routines/R11.webp` 정상 로딩, page error 0개. 미설정 auth helper 503 차단 확인 |
| 배포 안전 검사 | demo/HTTP/emulator 설정을 deploy guard가 거절. 로컬 Worker 번들은 결과물 검사에서도 Auth emulator 연결을 발견해 거절. 표준 production client에는 앱의 Auth emulator endpoint/테스트 proof가 포함되지 않음 |
| 검토 빌드 대상 | `CLOUDFLARE_ENV=preview npm run build`의 생성 config를 검사해 `jikkot-review` 확인. 최종 표준 빌드는 기존 `jikkot-ver9` 이름 확인. 원격 배포는 실행하지 않음 |

## 발견하고 해결한 실행 환경 문제

- 대상 잠금파일이 JSON 중간에서 끊겨 `npm ci`가 불가능했습니다. Firebase 의존성을 포함해 잠금파일을 다시 생성하고, 재설치로 재현성을 검증했습니다. 기존 chart의 누락된 `react-is` peer도 포함했습니다.
- Firebase CLI 최신 버전은 cloud proxy 환경에서 localhost 에뮬레이터 요청에도 proxy를 적용했습니다. `NO_PROXY`를 존중하는 14.22.0을 고정했습니다. TLS/체크섬 검증은 끄지 않았습니다.
- 의존성 재설치 후 Vite의 이전 optimize cache가 남아 504로 초기 hydration이 멈췄습니다. 서버 `--force` 재시작 후 전체 18개 검사가 통과했습니다. 설치와 서버/검사를 동시에 실행하지 않도록 start instructions에 명시했습니다.
- Vinext build는 `NODE_ENV=development`만으로 로컬 emulator 연결을 유지하지 않습니다. `JIKKOT_LOCAL_WORKER=true`를 사용하는 별도 로컬 빌드로 구분했고, deploy 및 번들 guard가 그 결과물의 원격 배포를 거절합니다.
- Wrangler CLI는 홈 설정 폴더가 쓰기 불가한 cloud sandbox에서 `XDG_CONFIG_HOME=/tmp/jikkot-wrangler`를 사용해 실행했습니다.

## 아직 검증하지 않은 운영 항목

실제 Firebase 프로젝트/Blaze/SMS, Google 실계정 redirect, Kakao/Naver 실제 code exchange, Cloudflare 원격 preview URL, 도메인/DNS·HTTPS는 소유자의 설정이 필요합니다. [설정 순서](deployment-guide-ko.md)를 따릅니다. 실공급자 인증 성공이나 원격 배포 성공으로 보고하지 않습니다.

조건부 최근 질문표·관련 부위 재추천표·악화 질문/연결표·실제 GIF는 미확정입니다. 기술 분기는 단위/서버 fixture로 검증했고 운영에는 fixture를 넣지 않았습니다. 빈 운영 연결은 ‘추가 추천 없음 → 완료하기’로 처리합니다. [콘텐츠 교체 지점](content-gaps.md)을 참고하세요.

개인정보/비의료 동의 `draft-v1`과 운영 보관기간은 출시 전 확정해야 합니다. 기존 D1 계정/데이터는 삭제·자동 이전하지 않았습니다. Firebase Auth와 Firestore 사이의 분산 가입은 예약/보상으로 처리하지만 완전한 분산 원자성을 주장하지 않습니다. 비회원 식별은 브라우저 단위이며 쿠키/익명 ID 삭제나 다른 브라우저까지 동일인을 보장하지 않습니다.
