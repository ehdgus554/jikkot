# 직꼿 추천 기능 교체 — Codex 실행 프롬프트

현재 열려 있는 직꼿 프로젝트에서 루틴 추천 기능을 실제로 수정해줘. 첨부한 11장의 이미지와 아래 명세를 기준으로 질문, 선택지, 추천 알고리즘, 추천 이유 문구, 루틴 콘텐츠, 이미지 연결을 함께 교체해야 한다. 설명이나 계획만 작성하지 말고 코드 수정과 검증까지 완료해줘.

먼저 저장소의 AGENTS.md, 프로젝트 구조, 기존 질문 데이터, 추천 엔진, 루틴 데이터, 결과 화면, 이미지 경로, 기록 저장 구조를 확인한다. 기존 기술과 구조를 최대한 활용하되 추천 기능의 입력부터 결과까지 실제 호출 경로 전체가 새 명세를 사용하게 한다. 이미지 파일이 채팅 첨부로 제공되어도 실제 런타임 파일 경로가 존재하는지 확인한다. 접근 가능한 프로젝트 경로로 가져오지 못한 파일은 접근 가능한 첨부 경로를 사용자에게 요청하고 임의 이미지로 대체하지 않는다.

## 1. 절대 규칙

사용자의 추천 질문은 정확히 세 번이다.

1. 어디가 불편한가요? — 부위 하나 선택
2. 평소 어떤 습관이 있나요? — 복수 선택
3. 오늘 또는 불편해지기 전에 무엇을 했나요? — 복수 선택

세 번째 답변 후 공식 동작 하나를 즉시 자동 추천한다.

- 별도의 세부 위치 질문, 추가 확인 질문, 동점 해소 질문, 강도 질문, 원인 질문, 자세 질문, 후보 고르기 화면을 추가하지 않는다.
- 첫 질문의 부위 옵션은 처음부터 세분화한다. 선택 후 추가 질문으로 위치를 다시 묻지 않는다.
- 세 번째 답변을 받은 뒤 네 번째 입력을 기다리지 않는다.
- 점수 합산, 가중치 경쟁, 동점 판단, 동점 후처리, 무작위 선택을 사용하지 않는다.
- 세 답변 조합을 부위별 결정 트리로 분류하고 최종 분기마다 동작 ID 하나를 반환한다.
- 복수 선택 조합도 구현한다. 단일 선택 사례만 구현하고 복합 선택은 미구현으로 남기지 않는다.
- 사용자가 습관·최근 행동을 모르는 경우에도 추가 질문 없이 해당 부위의 명시된 기본 분기로 진행한다.
- 기존 MVP 동작을 추천 후보에서 제외한다. 어깨 들었다 내리기, 어깨 돌리기, 준비 동작, 일반 긴장 완화를 공통 첫 추천으로 끼워 넣지 않는다.
- 승인 동작은 아래 1~11번이 전부다. 새로운 동작이나 변형을 만들지 않는다.
- 추천은 한 동작이다. 마사지+스트레칭 묶음, 여러 동작 순서, 준비 동작+본 동작으로 확장하지 않는다.
- 화면·문구에 내부 패턴 ID, 분기 ID, 알고리즘 용어를 노출하지 않는다.
- 동의, 회원가입·로그인, 회원/비회원 이용 제한, 저장·기록·로그아웃 등은 기존 기능을 보존한다. 기존의 별도 메뉴·관리 흐름을 새 추천 질문으로 삽입하지 않는다.
- 가능한 자세와 완료 후 피드백 등 기존 기능은 이번 추천 질문 세 개와 별개의 기존 맥락이다. 이 작업 때문에 새로운 입력을 추가하지 않는다. 첨부된 동작 콘텐츠는 앉아서 수행하는 버전이며 7·8번도 반드시 앉은 이미지다.
- 배포·외부 계정 변경은 요청 범위가 아니다. 코드 수정, 검증, 변경 내용 보고까지 진행한다.

## 2. 이미지와 동작 ID 연결

첨부 파일명은 아래 표를 우선 사용하되 이미지의 제목·번호·실제 동작도 확인한다. 파일명만으로 잘못 연결하지 않는다. 같은 동작의 수정 전·후 이미지가 여러 개면 사용자가 이번에 첨부한 최신 이미지가 우선이다.

| ID | 동작 이름 | 첨부 파일명 | 프로젝트에 저장할 권장 파일명 |
|---|---|---|---|
| 1 | Figure-4 스트레칭 + 허벅지 당기기 | Seated figure-four thigh pull guide(1).png | routine-01-figure4.png |
| 2 | 팔 꼬아 앞으로 밀며 고개 숙이기 | Seated Arm Reach and Neck Stretch(1).png | routine-02-upper-back.png |
| 3 | 견갑거근 대각선 스트레칭 | Two-Step Diagonal Neck Stretch(1).png | routine-03-diagonal-neck.png |
| 4 | 의자를 이용한 한쪽 가슴 열기 | Seated twist with aligned gaze(1).png | routine-04-single-chest.png |
| 5 | 책상 광배근·날개뼈 스트레칭 | Seated Desk Lat Stretch Guide(1).png | routine-05-desk-lat.png |
| 6 | 팔꿈치 붙이고 양손 바깥으로 벌리기 | Seated elbow-together outward rotation(1).png | routine-06-external-rotation.png |
| 7 | 앉아서 뒷짐 가슴 열기 | Seated chest-opening stretch guide(1).png | routine-07-seated-chest.png |
| 8 | 앉아서 손깍지 끼고 팔 뒤로 뻗기 | 08. 앉아서 손깍지 끼고 팔 뒤로 뻗기(1).png | routine-08-seated-interlace.png |
| 9 | 흉쇄유돌근 마사지 | Gentle seated SCM massage guide(1).png | routine-09-scm.png |
| 10 | 관자놀이 누르며 입 열고 닫기 | Gentle temple press jaw exercise(1).png | routine-10-temple-jaw.png |
| 11 | 쇄골 아래 바깥쪽 쓸어내기 마사지 | Under-Collarbone Chest Sweep Guide(1).png | routine-11-chest-sweep.png |

이미지는 정적 PNG 안내 이미지다. GIF나 동영상으로 표시하지 않고 애니메이션을 만들 필요도 없다. 기존 컴포넌트가 GIF만 받는다면 정적 이미지도 정상 표시하도록 수정한다. 전체 그림과 문구가 보이도록 contain 방식으로 표시하고 잘라내지 않는다. 모바일에서 확대해 읽을 수 있게 기존 기능을 활용한다. 외부 임시 URL에 의존하지 말고 저장소의 정적 자산 경로로 연결한다. 이미지 편집·재생성은 하지 않는다.

검수 기준: 4번은 몸통과 시선이 같은 방향, 7·8번은 앉은 자세, 7번은 손등이 허리에 닿고 양손 엄지가 안쪽으로 향하는 최신 그림이어야 한다.

## 3. 확정된 불편 부위 매핑

아래는 사용자가 정한 콘텐츠 매핑이다. 임의로 삭제하거나 다른 부위로 바꾸지 않는다.

| 동작 | 통증·불편부위 |
|---|---|
| 1 | 허리 아래쪽 |
| 2 | 날개뼈 사이, 등 위쪽 |
| 3 | 목부터 등 하부까지 승모근 |
| 4 | 어깨 앞쪽, 날개뼈 안쪽 |
| 5 | 날개뼈 사이, 어깨 |
| 6 | 날개뼈, 등, 어깨 앞과 뒤 |
| 7 | 등, 어깨 말림, 어깨 윗부분, 승모근 |
| 8 | 7번과 유사하되 어깨 윗부분이 중심 |
| 9 | 두통 |
| 10 | 두통 |
| 11 | 어깨 앞쪽, 어깨 말림 |

## 4. 첫 번째 질문과 부위 ID

질문: **어디가 불편한가요?**
설명: **가장 신경 쓰이는 곳 하나를 골라주세요.**
단일 선택. 선택 버튼의 다음 동작은 기존 디자인을 따른다.

| 부위 ID | 화면 문구 | 선택지 프로필 | 결정 트리 |
|---|---|---|---|
| lower_back | 허리 아래쪽 | lower | lower |
| between_scapulae | 날개뼈 사이 | back | between |
| inner_scapula | 날개뼈 안쪽 | back | inner |
| upper_back | 등 위쪽 | back | upper |
| general_back | 등 전반 | back | general |
| neck_trapezius | 목·승모근 주변 | neck | neck |
| front_shoulder | 어깨 앞쪽 | front | front |
| back_shoulder | 어깨 뒤쪽 | rear | rear |
| top_shoulder | 어깨 윗부분 | top | top |
| rounded_shoulder | 어깨가 앞으로 말린 느낌 | rounded | rounded |
| headache | 머리가 아파요 | head | head |

다른 기존 부위 메뉴가 있으면 이번 11개 동작으로 지원되는 선택지를 활성화한다. 지원하지 않는 부위를 임의로 이 중 하나로 바꾸거나 엉뚱한 동작을 반환하지 않는다. 기존 신체 그림의 선택 영역도 같은 부위 ID와 일치시킨다.

## 5. 두 번째 질문: 평소 습관

질문: **평소 어떤 습관이 있나요?**
설명: **자주 하는 행동을 모두 골라주세요.**

다음은 안정적인 데이터 ID다. ID와 한국어 문구를 분리한다.

| 습관 ID | 화면 문구 |
|---|---|
| H_SIT | 앉아 있는 시간이 길어요 |
| H_CROSS | 다리를 자주 꼬아요 |
| H_LEAN | 한쪽으로 기대 앉아요 |
| H_DRIVE | 운전을 오래 하는 편이에요 |
| H_BOTH_FRONT | 양팔을 앞에 둔 채 오래 작업해요 |
| H_ONE_FORWARD | 한쪽 팔을 앞으로 뻗어 마우스나 도구를 써요 |
| H_PINCH | 등을 펴려고 날개뼈를 모으고 힘을 줘요 |
| H_SHRUG | 일할 때 어깨에 힘이 들어가거나 올라가요 |
| H_SIDE_SCREEN | 옆에 있는 화면을 보려고 고개를 돌려요 |
| H_ELBOW | 한쪽 팔꿈치로 책상을 짚고 기대요 |
| H_OVERHEAD | 팔을 높이 들거나 멀리 뻗는 일이 많아요 |
| H_CARRY | 가방이나 물건을 오래 들고 있어요 |
| H_ARMS_CLOSE | 휴대폰이나 작은 물건을 몸 앞에 모아 사용해요 |
| H_CHEST_PUSH | 가슴 운동이나 물건을 미는 일을 자주 해요 |
| H_CLENCH | 집중하거나 긴장하면 이를 악물어요 |
| H_GRIND | 자는 동안 이를 갈거나 악무는 편이에요 |
| H_CHEW | 껌이나 질긴 음식을 오래 씹어요 |
| H_UNKNOWN | 잘 모르겠어요 / 해당하는 습관이 없어요 |

부위별로 아래 항목만 보여준다. H_UNKNOWN은 모든 프로필의 마지막에 추가한다.

| 프로필 | 보여줄 습관 ID |
|---|---|
| lower | H_SIT, H_CROSS, H_LEAN, H_DRIVE |
| back | H_BOTH_FRONT, H_ONE_FORWARD, H_PINCH, H_SHRUG, H_SIDE_SCREEN, H_OVERHEAD |
| neck | H_SHRUG, H_SIDE_SCREEN, H_ELBOW, H_CARRY, H_BOTH_FRONT |
| front | H_ONE_FORWARD, H_BOTH_FRONT, H_ARMS_CLOSE, H_CHEST_PUSH, H_OVERHEAD |
| rear | H_OVERHEAD, H_ARMS_CLOSE, H_ONE_FORWARD, H_BOTH_FRONT |
| top | H_SHRUG, H_ELBOW, H_SIDE_SCREEN, H_CARRY, H_OVERHEAD, H_BOTH_FRONT |
| rounded | H_BOTH_FRONT, H_ONE_FORWARD, H_ARMS_CLOSE, H_CHEST_PUSH |
| head | H_SIDE_SCREEN, H_SHRUG, H_BOTH_FRONT, H_CLENCH, H_GRIND, H_CHEW |

H_UNKNOWN은 다른 습관과 동시에 선택할 수 없다. H_UNKNOWN을 누르면 나머지를 해제하고, 다른 항목을 누르면 H_UNKNOWN을 해제한다. 선택지 하나 이상을 고른 뒤 다음으로 넘어간다. 선택 없이 넘기는 기존 기능이 있다면 빈 배열을 H_UNKNOWN과 같은 의미로 정규화하되 추가 질문을 만들지 않는다.

## 6. 세 번째 질문: 최근 행동

질문: **오늘 또는 불편해지기 전에 무엇을 했나요?**
설명: **최근에 한 행동을 모두 골라주세요.**

| 최근 행동 ID | 화면 문구 |
|---|---|
| R_SIT | 회의나 작업 때문에 오래 앉아 있었어요 |
| R_DRIVE | 운전을 오래 했어요 |
| R_COMPUTER_BOTH | 양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요 |
| R_ONE_HAND | 한쪽 손으로 마우스나 도구를 오래 사용했어요 |
| R_HEAD_TURN | 고개를 한쪽으로 돌리거나 같은 방향으로 오래 두었어요 |
| R_SHRUG | 어깨를 올리거나 힘을 준 채 일을 했어요 |
| R_BAG_CARRY | 가방을 한쪽 어깨에 오래 메고 있었어요 |
| R_OVERHEAD | 높은 곳을 정리하거나 팔을 위로·멀리 뻗는 일을 했어요 |
| R_HOLD_LOAD | 물건을 들거나 팔을 든 채 오래 버텼어요 |
| R_PHONE | 휴대폰을 보거나 작은 손작업을 오래 했어요 |
| R_PUSH_CHEST | 물건을 밀거나 가슴 운동을 했어요 |
| R_CLENCH | 집중하거나 긴장하면서 이를 악물었어요 |
| R_CHEW | 껌이나 질긴 음식을 오래 씹었어요 |
| R_NONE | 특별히 한 행동이 없어요 |
| R_UNKNOWN | 잘 기억나지 않아요 |

| 프로필 | 보여줄 최근 행동 ID |
|---|---|
| lower | R_SIT, R_DRIVE, R_COMPUTER_BOTH, R_PHONE |
| back | R_COMPUTER_BOTH, R_ONE_HAND, R_HEAD_TURN, R_OVERHEAD, R_HOLD_LOAD, R_PHONE |
| neck | R_HEAD_TURN, R_SHRUG, R_BAG_CARRY, R_HOLD_LOAD, R_COMPUTER_BOTH |
| front | R_ONE_HAND, R_COMPUTER_BOTH, R_PHONE, R_PUSH_CHEST, R_OVERHEAD, R_DRIVE |
| rear | R_OVERHEAD, R_PHONE, R_ONE_HAND, R_COMPUTER_BOTH, R_HOLD_LOAD |
| top | R_SHRUG, R_HEAD_TURN, R_OVERHEAD, R_HOLD_LOAD, R_BAG_CARRY, R_COMPUTER_BOTH |
| rounded | R_COMPUTER_BOTH, R_PHONE, R_ONE_HAND, R_PUSH_CHEST, R_DRIVE, R_HOLD_LOAD |
| head | R_HEAD_TURN, R_COMPUTER_BOTH, R_DRIVE, R_CLENCH, R_CHEW, R_SHRUG |

R_NONE과 R_UNKNOWN은 모든 프로필 마지막에 추가한다. 두 항목은 일반 항목과 동시에 선택하지 않고, 서로도 동시에 선택하지 않는다. 특별 항목 선택 시 일반 선택을 해제하고, 일반 항목 선택 시 특별 항목을 해제한다.

평소 습관과 관련된 항목을 앞에 정렬할 수는 있지만, 표에 정의된 다른 최근 행동을 숨기지 않는다. 최근 행동의 표시 순서가 추천 결과에 영향을 주면 안 된다.

## 7. 추천 엔진: 점수 없이 단일 분기로 결정

추천 함수는 기존 코드 스타일에 맞추되 개념적으로 아래 입력과 출력을 사용한다.

입력: { bodyAreaId, habitIds: Set, recentActionIds: Set }
출력: { routineId, ruleId, matchedHabitIds, matchedRecentActionIds, reasonText }

선택 배열을 Set으로 정규화한다. 아래 표는 부위별 결정 트리다. 위에서 아래로 평가해 첫 번째로 충족되는 최종 분기에서 즉시 반환한다. 이는 최고점 후보를 비교하는 과정이 아니라 처음부터 하나의 결과로 분류하는 순차 분기다. 각 후속 분기는 앞의 분기가 충족되지 않았다는 조건을 포함한다. 이 제외 조건을 규칙 메타데이터 및 검증에서도 반영하여 최종 분기 적중 수가 정확히 하나인지 확인한다. 최종 분기들은 서로 배타적이어야 한다.

현재 행동의 구체적 신호를 먼저 사용하고, 특정 최근 행동이 없는 조합은 습관 신호로 분류한다. 여러 행동이 선택된 경우도 아래 순서로 이미 명시되어 있으므로 추가 질문이나 런타임 동점 처리를 하지 않는다. 순서와 조건은 콘텐츠 데이터로 관리하고 근거 없는 번호순 정렬로 바꾸지 않는다.

다음 합성 조건을 사용한다.

- N: R_HEAD_TURN이 있고 H_SIDE_SCREEN 또는 H_SHRUG가 있음.
- U: R_OVERHEAD가 있음.
- L: R_HOLD_LOAD가 있음.
- O: R_ONE_HAND가 있고 H_ONE_FORWARD가 있음.
- B: R_COMPUTER_BOTH 또는 R_DRIVE가 있음.
- P: R_PHONE가 있음.
- C: R_PUSH_CHEST가 있음.
- J: R_CLENCH 또는 R_CHEW가 있음.
- H_NECK: H_SIDE_SCREEN 또는 H_SHRUG 또는 H_ELBOW가 있음.
- H_FRONT_BOTH: H_BOTH_FRONT가 있음.
- H_JAW: H_CLENCH 또는 H_GRIND 또는 H_CHEW가 있음.
- NO_SPECIFIC_RECENT: R_NONE 또는 R_UNKNOWN 또는 빈 최근 행동 집합.

| 결정 트리 | 순서대로 적용할 조건 → 결과 |
|---|---|
| lower | 모든 유효 조합 → 1 |
| between | N → 3; U → 5; L이고 H_FRONT_BOTH가 있으면 → 8; H_PINCH가 있고 B이면 → 2; P → 6; B → 2; R_ONE_HAND → 6; L → 8; NO_SPECIFIC_RECENT이고 H_OVERHEAD → 5; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_PINCH → 2; 그 외 → 2 |
| inner | N → 3; O → 4; U → 5; L → 8; P → 6; B이고 H_FRONT_BOTH → 7; R_ONE_HAND → 4; B → 2; NO_SPECIFIC_RECENT이고 H_ONE_FORWARD → 4; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_OVERHEAD → 5; 그 외 → 2 |
| upper | N → 3; L → 8; U이고 H_OVERHEAD → 6; H_PINCH가 있고 B → 2; B이고 H_FRONT_BOTH → 7; P 또는 R_ONE_HAND → 6; B → 2; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_FRONT_BOTH → 7; 그 외 → 2 |
| general | N → 3; L → 8; B이고 H_FRONT_BOTH → 7; P 또는 R_ONE_HAND → 6; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_FRONT_BOTH → 7; 그 외 → 6 |
| neck | R_HEAD_TURN 또는 R_SHRUG → 3; L → 8; R_BAG_CARRY → 3; B → 7; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_CARRY → 8; 그 외 → 3 |
| front | C → 11; O → 4; U → 5; P → 6; R_ONE_HAND → 4; B이고 H_ONE_FORWARD → 4; B → 6; NO_SPECIFIC_RECENT이고 H_CHEST_PUSH → 11; NO_SPECIFIC_RECENT이고 H_ONE_FORWARD → 4; NO_SPECIFIC_RECENT이고 H_ARMS_CLOSE → 6; NO_SPECIFIC_RECENT이고 H_OVERHEAD → 5; 그 외 → 4 |
| rear | U 또는 L → 5; NO_SPECIFIC_RECENT이고 H_OVERHEAD → 5; 그 외 → 6 |
| top | R_HEAD_TURN 또는 R_SHRUG → 3; L → 8; U → 5; R_BAG_CARRY → 3; B → 7; NO_SPECIFIC_RECENT이고 H_NECK → 3; NO_SPECIFIC_RECENT이고 H_CARRY → 8; NO_SPECIFIC_RECENT이고 H_OVERHEAD → 5; 그 외 → 7 |
| rounded | C → 11; L → 8; B 또는 P 또는 R_ONE_HAND → 7; NO_SPECIFIC_RECENT이고 H_CHEST_PUSH → 11; 그 외 → 7 |
| head | J → 10; R_HEAD_TURN 또는 R_SHRUG → 9; B이고 H_SIDE_SCREEN → 9; H_JAW → 10; H_SIDE_SCREEN 또는 H_SHRUG → 9; 그 외 → 10 |

별도 규칙 ID를 부여하고 최종 선택에 실제로 관여한 습관·행동만 matched 필드에 넣는다. 예를 들어 between의 U 분기에서 H_PINCH도 선택돼 있었다고 해서 추천 이유에 H_PINCH를 이유로 넣지 않는다. 기본 분기는 선택 부위만 설명에 사용한다.

모든 유효 입력을 처리하는 기본 분기는 위 표에 이미 명시돼 있다. 기본 분기를 '어깨 들었다 내리기'나 아직 남아 있는 기존 추천 엔진으로 연결하지 않는다.

복합 조합 예: head에서 R_HEAD_TURN과 R_CLENCH를 함께 골랐으면 J 분기인 10번. top에서 R_HEAD_TURN과 R_HOLD_LOAD를 함께 골랐으면 첫 분기인 3번. front에서 R_ONE_HAND와 R_PUSH_CHEST를 함께 골랐으면 C 분기인 11번. 이처럼 조합의 결과를 사전에 정하고 실행 중 동점으로 분류하지 않는다.

## 8. 부위별 허용 동작

최종 결과가 아래 범위 밖으로 나가지 않도록 확인한다. 원문 부위 매핑의 넓은 등·날개뼈 영역은 이 범위로 정규화한다.

| 부위 ID | 허용 동작 |
|---|---|
| lower_back | 1 |
| between_scapulae | 2, 3, 5, 6, 7, 8 |
| inner_scapula | 2, 3, 4, 5, 6, 7, 8 |
| upper_back | 2, 3, 6, 7, 8 |
| general_back | 3, 6, 7, 8 |
| neck_trapezius | 3, 7, 8 |
| front_shoulder | 4, 5, 6, 11 |
| back_shoulder | 5, 6 |
| top_shoulder | 3, 5, 7, 8 |
| rounded_shoulder | 7, 8, 11 |
| headache | 9, 10 |

## 9. 추천 이유 문구

추천 이유는 사용자가 실제로 선택한 정보만으로 작성한다. 새 알고리즘에서 쓰지 않는 기존 분석 문구·원인 추정 템플릿도 함께 교체한다.

기본 형식: **[최종 분기의 실제 입력을 한 문장으로 설명] + [아래 동작별 연결 문구]**

선택 행동이 여럿일 때 모두 나열하지 말고 최종 분기를 결정한 항목 1~2개만 자연스럽게 연결한다. 두 문장 이내로 작성한다. 일치한 습관이 없다면 '평소 ~하는 편이라서'를 만들지 않는다.

| 동작 | 동작별 연결 문구 |
|---|---|
| 1 | 엉덩이와 골반 주변을 가볍게 움직이는 동작으로 허리 아래쪽의 뻣뻣함을 풀어보세요. |
| 2 | 날개뼈 사이를 벌리고 등 위쪽을 부드럽게 늘리는 동작을 추천해요. |
| 3 | 어깨를 편하게 두고 목과 날개뼈 위쪽을 대각선으로 늘리는 동작을 추천해요. |
| 4 | 한쪽 가슴과 어깨 앞쪽을 여는 동작으로 움직임을 바꿔보세요. |
| 5 | 책상에 손을 두고 겨드랑이와 등 주변을 길게 늘리는 동작을 추천해요. |
| 6 | 팔꿈치를 몸에 붙이고 어깨를 바깥으로 가볍게 움직여보세요. |
| 7 | 앉아서 가슴을 열고 어깨와 등 주변을 편하게 움직여보세요. |
| 8 | 앉아서 손깍지 낀 팔을 뒤로 뻗으며 가슴과 어깨 주변을 열어보세요. |
| 9 | 목 옆을 가볍게 문지르며 긴장감을 풀어보세요. |
| 10 | 관자놀이에 손끝을 가볍게 대고 턱을 천천히 움직여보세요. |
| 11 | 쇄골 아래 가슴 윗부분을 어깨 방향으로 부드럽게 쓸어보세요. |

완성 문구 예:

- '오래 앉아 있었다고 선택했어요. 엉덩이와 골반 주변을 가볍게 움직이는 동작으로 허리 아래쪽의 뻣뻣함을 풀어보세요.'
- '한쪽 팔을 앞으로 뻗어 마우스를 오래 사용했다고 선택했어요. 한쪽 가슴과 어깨 앞쪽을 여는 동작을 추천해요.'
- '최근 이를 악물거나 오래 씹었다고 선택했어요. 관자놀이에 손끝을 가볍게 대고 턱을 천천히 움직여보세요.'
- 기본 분기에서는 '선택한 [부위 이름]을 편하게 움직일 수 있는 동작을 준비했어요.' 뒤에 동작별 연결 문구를 사용한다. 해당 없음·잘 모름을 선택했다는 이유로 부정적인 안내를 띄우지 않는다.

이미지 안의 문구와 화면의 문구를 일치시킨다. 새 경고·설문·동의 단계나 별도의 의학 설명을 추가하지 않는다. 기존 공통 안내는 기존 위치에서 유지한다.

## 10. 동작 안내 텍스트 교체

첨부 이미지를 보며 따라 할 수 있도록 아래 내용을 루틴 안내 데이터에 넣는다. 제목, 이미지, 설명이 다른 동작으로 섞이지 않게 한다. 동작별 단계 수는 유연하게 표시하며 모두 세 단계로 강제하지 않는다.

1. **Figure-4 스트레칭 + 허벅지 당기기**
   - 의자에 앉아 한쪽 발목을 반대쪽 허벅지 위에 올려요.
   - 올라온 다리의 허벅지 아래를 양손으로 받쳐 몸 쪽으로 부드럽게 당겨요.
   - 무릎을 아래로 누르는 동작이 아니에요.
2. **팔 꼬아 앞으로 밀며 고개 숙이기**
   - 팔을 교차해 손을 잡고 앞으로 길게 뻗어요.
   - 날개뼈 사이가 벌어지도록 등 위쪽을 부드럽게 둥글게 만들어요.
   - 고개를 편하게 숙여요.
3. **견갑거근 대각선 스트레칭**
   - 한쪽 손으로 의자 옆을 잡고 어깨를 편하게 아래로 둬요.
   - 고개를 반대쪽으로 돌린 뒤 그쪽 겨드랑이를 보듯 대각선으로 숙여요.
   - 반대 손은 머리 위에 가볍게 얹고 세게 당기지 않아요.
4. **의자를 이용한 한쪽 가슴 열기**
   - 한쪽 손을 같은 쪽 엉덩이 뒤나 좌판 뒤에 고정해요.
   - 가슴을 편하게 세우고 몸통과 시선을 손을 둔 쪽의 반대 방향으로 함께 돌려요.
5. **책상 광배근·날개뼈 스트레칭**
   - 양손을 책상 위에 두고 의자를 뒤로 보내며 상체를 숙여요.
   - 한쪽을 더 늘리고 싶으면 그쪽 손을 조금 더 앞으로 뻗어요.
6. **팔꿈치 붙이고 양손 바깥으로 벌리기**
   - 팔꿈치를 몸통에 붙이고 손바닥을 위로 둬요.
   - 팔꿈치는 제자리에 두고 양손을 바깥으로 벌려요.
7. **앉아서 뒷짐 가슴 열기**
   - 의자에 앉아 양손의 손등을 허리 뒤에 대요.
   - 엄지는 안쪽을 향하게 두고 팔꿈치를 살짝 뒤로 보내며 가슴을 열어요.
   - 허리를 과하게 꺾지 않아요.
8. **앉아서 손깍지 끼고 팔 뒤로 뻗기**
   - 의자에 앉아 등 뒤에서 손깍지를 껴요.
   - 가슴을 편하게 세우고 팔을 뒤로 길게 뻗어요.
9. **흉쇄유돌근 마사지**
   - 귀 뒤에서 쇄골로 이어지는 목 옆 근육에 손끝을 가볍게 대요.
   - 표면을 부드럽게 문질러요.
10. **관자놀이 누르며 입 열고 닫기**
    - 양쪽 관자놀이에 손끝을 가볍게 대요.
    - 손끝을 둔 채 입을 편한 범위에서 천천히 열고 닫아요.
11. **쇄골 아래 바깥쪽 쓸어내기 마사지**
    - 쇄골 바로 아래 가슴 윗부분에 손을 가볍게 대요.
    - 가슴 중앙에서 어깨 방향으로 천천히 쓸어줘요.

위 설명은 동작 콘텐츠다. 별도의 질문으로 바꾸지 않는다. 수행 시간·반복 횟수는 기존 승인된 동작별 데이터가 있으면 재사용한다. 확인되지 않은 숫자를 임의로 새로 지정하지 않는다. 기록·타이머 구조 때문에 필요하다면 기존 기본값을 사용하고 변경 보고에 그 사실을 적는다.

## 11. 기존 코드와의 통합

- 질문 목록, 옵션, bodyArea 별 연결, recommend 함수, 결과 이유 문구, 루틴 카드, 대체 추천 경로까지 전역 검색한다.
- 새 엔진 파일을 만들기만 하고 실제 화면이 옛 엔진을 호출하는 상태로 끝내지 않는다.
- 기존 준비 동작·일반 긴장 완화의 fallback 호출을 제거한다.
- 질문이나 부위를 뒤로 가서 변경하면 이후 답변과 추천 결과를 초기화한다. 새 프로필에서 보이지 않는 이전 선택이 숨은 입력으로 남으면 안 된다.
- 저장된 과거 기록의 기존 동작 ID를 새 번호와 혼동하지 않는다. 새 동작은 jikkot11-r01 같은 충돌 없는 ID를 쓰고 displayNumber=1처럼 표시 번호를 분리한다.
- 추천 버전을 jikkot11-v1 등으로 기록한다. 과거 기록은 유지하며 새 추천에는 새 버전만 사용한다.
- 완료 후 피드백은 기존 흐름을 유지한다. 비슷·더 불편으로 대체 동작을 보여주는 기존 기능이 있다면 그 경로도 승인된 11개와 해당 부위 매핑 안에서만 작동하도록 연결한다. 동일 동작 재추천을 피하고, 기존 질문 외에 새로운 추천 질문을 만들지 않는다. 사용 가능한 다른 동작이 없으면 기존 완료 흐름으로 이어지게 하고 새 동작을 만들지 않는다.
- 기본 추천은 항상 동작 하나다. 기능 변경을 핑계로 새 메뉴·새 페이지·새 상품·새 외부 서비스를 추가하지 않는다.

## 12. 검증과 완료 조건

이 변경은 핵심 추천 로직 교체이므로 의미 있는 로직 테스트와 화면 흐름 검증을 수행한다. 기존 테스트 체계가 있으면 활용한다.

필수 입력·결과 사례:

| 부위 | 습관 | 최근 행동 | 기대 동작 |
|---|---|---|---|
| lower_back | H_SIT | R_DRIVE | 1 |
| between_scapulae | H_PINCH | R_COMPUTER_BOTH | 2 |
| neck_trapezius | H_SHRUG, H_SIDE_SCREEN | R_HEAD_TURN | 3 |
| front_shoulder | H_ONE_FORWARD | R_ONE_HAND | 4 |
| between_scapulae | H_OVERHEAD | R_OVERHEAD | 5 |
| back_shoulder | H_ARMS_CLOSE | R_PHONE | 6 |
| rounded_shoulder | H_BOTH_FRONT | R_COMPUTER_BOTH | 7 |
| top_shoulder | H_CARRY | R_HOLD_LOAD | 8 |
| headache | H_SIDE_SCREEN | R_HEAD_TURN | 9 |
| headache | H_CLENCH | R_CLENCH | 10 |
| front_shoulder | H_CHEST_PUSH | R_PUSH_CHEST | 11 |
| headache | H_SIDE_SCREEN, H_CLENCH | R_HEAD_TURN, R_CLENCH | 10 |
| top_shoulder | H_CARRY, H_SIDE_SCREEN | R_HOLD_LOAD, R_HEAD_TURN | 3 |
| front_shoulder | H_ONE_FORWARD, H_CHEST_PUSH | R_ONE_HAND, R_PUSH_CHEST | 11 |

추가 검증 요구사항:

- 부위별로 UI에서 실제 선택 가능한 습관·최근 행동의 모든 유효 부분집합을 열거한다. H_UNKNOWN 및 R_NONE/R_UNKNOWN의 배타 규칙을 반영한다.
- 전체 유효 조합에서 결과가 정확히 하나이고, 허용 동작 범위 안이며, 추천 이미지·제목·문구가 존재하는지 확인한다.
- 모든 동작 1~11번이 실제 입력 조합에서 도달 가능한지 확인한다.
- 선언됐지만 절대로 실행되지 않는 조건이 없는지 확인하고 불필요한 조건을 제거한다.
- 입력 배열의 순서를 바꿔도 결과가 같아야 한다.
- 복합 행동 조합의 예상 결과와 기본 분기 결과를 검증한다.
- 세 번째 답변 직후 결과 화면이 뜨고 네 번째 질문이 존재하지 않는지 검증한다.
- 이전 답변 초기화, 특별 옵션 배타 처리, 실제 11개 이미지 경로, 모바일 이미지 표시, 결과 문구에 미선택 행동이 들어가지 않는지를 확인한다.
- 같은 이미지 파일이 서로 다른 동작으로 잘못 연결되지 않았는지 확인한다.
- 기본 분기로만 도달하는 동작과 특정 입력 분기로 도달하는 동작을 구분해 결과를 확인한다.
- 프롬프트 예시뿐 아니라 서로 다른 두 입력이 실제로 서로 다른 적절한 동작으로 연결되는지 확인한다. 특정 동작만 반복되는 회귀가 없어야 한다.
- 기존 핵심 회원·비회원 제한, 저장·기록 기능이 유지되는지 변경과 관련된 범위에서 확인한다.
- 프로젝트에서 사용하는 빌드·타입 검사·린트·관련 테스트를 실행하고 실제 결과를 보고한다. 실행하지 않은 검증을 완료했다고 쓰지 않는다.

작업 완료 후에는 변경된 파일, 실제 교체한 호출 경로, 질문 세 개, 이미지 연결 결과, 실행한 검증과 결과만 간단히 보고한다. 재설계 제안으로 끝내지 말고 명세대로 구현을 완료한다.
