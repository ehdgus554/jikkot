# jikkot11-v1 추천 기능 교체 결과

대상: `ehdgus554/jikkot`, 작업 브랜치 `feat/jikkot11-recommendations`. 기준은 사용자가 구현을 지시한 [교체 명세 원문](recommendation-replacement-request.md)과 `jikkot-original-png-11.zip`입니다. 배포와 외부 계정 변경은 실행하지 않았습니다.

## 실제 교체한 경로

- `app/jikkot-data.ts`: 승인 부위 11개, 프로필별 습관·최근 행동, 승인 동작 11개와 단계·원본 PNG 경로.
- `lib/service/decision-trees.ts`: 문서 순서의 84개 최종 분기와 앞 분기를 제외하는 메타데이터.
- `lib/service/recommendation.ts`: 점수/MVP 후보 정렬 없이 하나를 결정, 실제 일치 입력만 사용하는 두 문장 이유, 새 스냅샷, 승인 매핑 내 대체 추천.
- `app/jikkot-app.tsx`: 세 질문 화면과 특별 선택 배타 처리, 이전 답변 변경 시 이후 답변/결과 초기화, 원본 스냅샷 기반 과거 부위별 기록 표시. 소셜 취소 URL이 초기화 과정에서 사라지는 경쟁도 수정.
- `lib/service/public-preview.ts`의 기존 호출 → 새 추천 엔진 → 결과 화면. Firebase 미연결 미리보기도 새 콘텐츠를 사용합니다.
- `worker/spark-api.ts`의 `/recommendations`·`/next` → 새 엔진 → Firestore. 참고용 `functions/src/index.ts`도 같은 엔진/버전으로 통합하고 컴파일 확인.
- `lib/service/progress.ts`: 진행 스키마 2와 새 콘텐츠 버전 검사. 과거 진행 캐시를 새 질문에 복원하지 않으며 저장된 기록은 변경하지 않음.
- `components/routine-media.tsx`: 단계 수에 맞는 목록, 정적 PNG 전체 표시(`contain`), 모바일 원본 확대. 수행 시간/횟수는 임의로 추가하지 않음.
- `scripts/validate-content.ts`, 서비스/API/브라우저/이미지 테스트와 기존 Worker/공개 미리보기 검사도 새 호출 경로에 맞춰 갱신.

## 질문과 결과

1. 어디가 불편한가요? — 하나 선택.
2. 평소 어떤 습관이 있나요? — 복수 선택.
3. 오늘 또는 불편해지기 전에 무엇을 했나요? — 복수 선택.

세 번째 답변 제출 후 동작 하나를 자동 추천합니다. 자세/세부 위치/강도/후보 선택 등 추가 질문은 없습니다. 기존 자세 필드는 기록·API 호환 맥락에 남으며 신규 안내는 앉은 버전입니다. 내부 분기 ID는 저장 메타데이터로만 사용하고 화면에서 노출하지 않습니다.

새 동작은 `jikkot11-r01`~`jikkot11-r11`, 표시 번호는 1~11입니다. 새 스냅샷의 버전은 `jikkot11-v1`. 과거 MV009 등의 ID·제목·부위·안내·버전은 치환하지 않습니다. 대체 추천에서는 같은 부위의 승인 동작 중 현재 연속 추천에서 이미 안내한 동작을 모두 제외합니다. 남은 동작이 없으면 기존 완료 흐름으로 이어집니다.

## 이미지 연결

`public/assets/routines/routine-*.png` 11장을 ZIP 원본에서 그대로 복사했습니다. 각 원본의 번호·제목·동작을 직접 확인했습니다. 4번 몸통/시선 방향, 7번 앉은 자세/손등/안쪽 엄지, 8번 앉은 자세/손깍지를 확인했습니다. [원본 파일·정적 경로·SHA-256 매핑](jikkot11-image-manifest.json)에 대응을 기록했습니다.

파일 편집·재생성·변환 없이 SHA-256이 원본과 같으며, 11개 경로가 서로 다른 PNG를 사용합니다. 빌드 결과의 PNG 11장도 원본 해시와 일치했습니다. 기존 WebP/SVG는 과거 경로를 보존하도록 남겼으며 새 추천에서는 사용하지 않습니다.

## 실행한 검증

환경: Node 22, Java 21, Firebase CLI 14.22.0, 실제 `demo-jikkot` Auth/Firestore 에뮬레이터, 시스템 Chromium, Cloudflare local workerd. 실제 운영 계정/데이터는 사용하지 않았습니다.

| 검증 | 최종 결과 |
|---|---|
| `npm run content:check` | 특별 옵션 배타/빈 배열을 포함한 31,046개 조합. 정확히 한 분기, 허용 동작, 배열 순서 불변, 이유의 실제 입력 일치, 84개 분기 도달 확인 |
| 필수 예시 | 단일·복합 선택 14개 모두 지정한 동작 1~11 반환 |
| `npm test` | 콘텐츠 검사 + production 빌드 + UI 7개 + 서비스 11개 + 원본 이미지 11개 통과(총 29개 테스트) |
| `npm run typecheck` | 루트 및 참고 Functions TypeScript 컴파일 통과 |
| `npm run lint` | 오류·경고 없이 통과 |
| `npm run test:spark` | 9개 통과. 동시 가입/하루 한도, 동의, 소유권, 피드백 재시도, Google 공급자 검사, signed JWT/권한 규칙, 대체 추천 소진, 과거 스냅샷 보존 |
| `npm run test:browser` | 360px·390px·PC에서 기본/새 추천 회귀 27개 통과. PNG HTTP/해시 검사 3개는 Node JSON import 방식 수정 후 재실행 통과. 연속 대체 추천 검사 3개 추가 통과. 최종 고유 시나리오 총 33개 |
| `npm run test:public-preview` | Firebase 설정 없는 production 번들을 local workerd에서 검증. 세 화면 크기의 새 문진→추천→완료, Auth/API 요청 없음, 진행 저장 없음, 오류/화면 넘침 없음 |
| production 정적 자산 | 빌드 결과 11개 PNG가 원본 해시와 일치 |

총 71개 테스트와 31,046개 조합 검사, 별도의 공개 미리보기 런타임 검사가 통과했습니다. 초기 원본 미전달로 실패했던 이미지 검사는 ZIP 확보 후 전부 재검증하여 해결했습니다. 운영 배포 및 실제 Google 계정 인증은 이번 검증에 포함하지 않았습니다.

기본 분기로만 도달하는 동작은 1번, 특정 입력 분기로만 도달하는 동작은 5·8·9·11번입니다. 2·3·4·6·7·10번은 기본 및 특정 입력 분기 모두에서 도달합니다.
