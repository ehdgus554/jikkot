# 직꼿 업데이트 실행 프롬프트 - 다섯 부위·세 질문·실제 배포

현재 작업 중인 직꼿 프로그램의 추천 기능을 아래 명세로 교체하고, 검증과 기존 운영 사이트 배포까지 완료해줘. 계획이나 설명만 작성하고 끝내지 말고 실제 코드를 수정해줘.

이 요청은 구현, 관련 테스트, 필요한 커밋·푸시, 기존 배포 경로를 이용한 운영 반영까지 포함한다. 배포 여부를 다시 묻지 말고 완료까지 진행한다. 로그인·배포 권한 등 실제 접근이 부족하면 진행 가능한 구현과 검증은 먼저 끝낸 뒤, 막힌 단계와 꼭 필요한 정보만 구체적으로 알려준다. 실행하지 못한 배포를 완료했다고 하지 않는다.

## 1. 가장 우선하는 변경

추천의 첫 질문은 정확히 아래 다섯 부위만 보여준다.

**머리 / 목 / 어깨 / 등 / 허리**

- 어깨 앞·뒤·위, 날개뼈 사이·안쪽, 등 위쪽, 승모근, 어깨 말림 등의 세부 부위 버튼은 새 추천에서 제거한다.
- 부위를 고른 뒤 세부 위치를 다시 묻지 않는다. 세부 부위를 펼치는 하위 메뉴도 만들지 않는다.
- 신체 그림을 사용한다면 클릭 가능한 영역도 이 다섯 부위와 일치시킨다. 필요하면 기존 디자인에 맞는 다섯 버튼으로 제공한다.
- 동작을 구분하는 정보는 평소 습관과 최근 행동의 기존 두 질문 안에서 처리한다.
- 추천 질문은 정확히 세 개다. ① 어디가 불편한가요? ② 평소 어떤 습관이 있나요? ③ 오늘 또는 불편해지기 전에 무엇을 했나요?
- 세 번째 답변 제출 직후 공식 동작 하나를 자동 추천한다. 결과 확인 버튼 등 기존 기본 화면 동작은 사용할 수 있지만 네 번째 질문·추가 확인·동점 해소·후보 선택은 금지한다.
- 점수·가중치·동점 경쟁·무작위 선택·생성형 AI 추정으로 추천하지 않는다. 아래 순차 분기 그대로 구현한다.
- 마사지와 스트레칭을 묶지 않고 한 동작만 제공한다. 승인된 11개 외에 준비 동작·어깨 돌리기·일반 긴장 완화 등을 끼워 넣지 않는다.
- 이전 11개 세부 부위 명세보다 이 문서가 우선한다. 기존 코드를 분석해도 선택지나 우선순위를 임의로 재설계하지 않는다.
- 별도의 새로운 경고·설문·동의 단계·의학 설명을 추가하지 않는다. 기존 공통 안내는 기존 위치에서 유지한다.

## 2. 먼저 확인할 기존 프로젝트

AGENTS.md와 프로젝트 구조, 질문 데이터, 실제 추천 호출 경로, 결과 문구, 동작·이미지 데이터, 회원 기록, 현재 Git 원격과 배포 설정을 확인한다. 기존 디자인·언어·프레임워크를 활용한다.

대상은 사용자가 현재 운영하는 직꼿 프로젝트다. 기존 계획의 대상 저장소는 `ehdgus554/jikkot`이며 `jikkot-ver9`는 기존 소스 이름이다. 작업 환경·현재 배포 설정에서 실제 연결을 확인하고 엉뚱한 프로젝트에 배포하지 않는다. 이번 요청을 이유로 별도 사이트·새 도메인·새 Firebase 프로젝트를 만들지 않는다.

현재 배포는 기존 Cloudflare 연결을, 백엔드는 기존 Firebase 연결을 재사용한다. 실제 연결 방식은 저장소와 환경 설정으로 확인한다. 기존 도메인 및 인증·데이터 연결이 유지되도록 변경한다.

## 3. 세 질문의 동작

1. **어디가 불편한가요?** - 설명: 가장 신경 쓰이는 곳 하나를 골라주세요. 단일 선택, 다섯 부위만.
2. **평소 어떤 습관이 있나요?** - 설명: 자주 하는 행동을 모두 골라주세요. 복수 선택.
3. **오늘 또는 불편해지기 전에 무엇을 했나요?** - 설명: 최근에 한 행동을 모두 골라주세요. 복수 선택.

질문 2·3의 목록은 선택 부위의 프로필을 사용한다. 아래 JSON의 `habitProfiles`와 `recentProfiles`가 보여줄 전체 일반 항목과 기본 표시 순서다. 모든 부위에 질문 2의 마지막 항목으로 `H_UNKNOWN`, 질문 3의 마지막 두 항목으로 `R_NONE`, `R_UNKNOWN`을 추가한다. JSON 사전에 존재해도 해당 부위의 프로필에 없는 항목은 표시하지 않는다.

- `H_UNKNOWN` 선택 시 다른 습관을 모두 해제한다. 다른 습관 선택 시 `H_UNKNOWN`을 해제한다.
- `R_NONE`과 `R_UNKNOWN`은 서로 및 일반 행동과 함께 선택하지 않는다. 특별 항목 선택 시 나머지를 해제하며 일반 항목 선택 시 두 특별 항목을 해제한다.
- 평소 습관에 맞춰 최근 행동을 앞에 정렬할 수는 있지만 다른 최근 행동을 숨기지 않는다. 정렬이나 클릭 순서는 결과를 바꾸지 않는다.
- 질문 2·3은 하나 이상을 선택해 제출한다. 기존 상태 복원에서 빈 배열이 들어오면 습관은 `H_UNKNOWN`, 행동은 `R_UNKNOWN`으로 정규화하되 새 질문을 추가하지 않는다.
- 선택 부위를 바꾸면 이후 답변과 결과를 초기화한다. 습관을 다시 변경하면 최근 행동과 결과를 초기화한다. 제출된 답변에 프로필 밖의 숨은 선택이 남지 않게 한다.
- 부위 선택 이전의 기존 자세·동의·로그인 단계, 추천 이후 기존 완료·피드백은 이 추천 질문 세 개와 별개의 기존 서비스 맥락이다. 이번 작업 때문에 입력을 추가하지 않는다.

## 4. 질문 문구·선택지·추천 규칙의 완전한 데이터

아래 `SPEC`가 구현 기준이다. UI 문구와 ID는 분리한다. 한 규칙의 `when` 바깥 배열은 AND, 안쪽 배열은 OR다. 예를 들어 `[["NR"], ["H_SIDE_SCREEN", "H_SHRUG"]]`는 '최근 행동이 없음 또는 모름 AND 평소 옆 화면 보기 또는 어깨에 힘주기'다.

- `ALWAYS`: 앞 규칙이 하나도 적용되지 않았을 때의 기본 결과. `lower`에서는 모든 조합의 결과.
- `NR`: 최근 행동이 없음(`R_NONE`)·모름(`R_UNKNOWN`) 또는 정규화 전 빈 행동 배열.
- 합성 조건은 `compositeConditions`에 선언한 AND/OR로 평가한다.
- 부위별 `rules`의 위에서 아래 순서를 유지하고 처음 충족되는 규칙 하나에서 반환한다. 후속 규칙은 앞 규칙들이 적용되지 않았다는 조건을 포함한 분기로 해석한다.
- `head`의 뒤쪽 습관 규칙은 특정 최근 행동이 있어도 앞 규칙에 해당하지 않으면 적용한다. 이를 `NR`로 임의 제한하지 않는다.
- `neck`, `shoulder`, `back`의 `NR` 규칙은 최근 행동이 없음·모름일 때만 적용한다. 실제 행동이 있는 조합을 그 습관 분기에 넘기지 않는다.
- `back`의 일반 기본값 2번이 `NR` 습관 분기를 가로막지 않도록 반드시 JSON 순서를 따른다.
- 부위별 허용 동작은 `allowedRoutines`다. 허리는 현재 공식 동작 1번뿐이므로 모든 유효 조합에서 1번을 추천한다.

```json
{
  "bodyAreas": [
    {
      "id": "head",
      "label": "머리"
    },
    {
      "id": "neck",
      "label": "목"
    },
    {
      "id": "shoulder",
      "label": "어깨"
    },
    {
      "id": "back",
      "label": "등"
    },
    {
      "id": "lower",
      "label": "허리"
    }
  ],
  "habits": {
    "H_SIT": "앉아 있는 시간이 길어요",
    "H_CROSS": "다리를 자주 꼬아요",
    "H_LEAN": "한쪽으로 기대 앉아요",
    "H_DRIVE": "운전을 오래 하는 편이에요",
    "H_BOTH_FRONT": "양팔을 앞에 둔 채 오래 작업해요",
    "H_ONE_FORWARD": "한쪽 팔을 앞으로 뻗어 마우스나 도구를 써요",
    "H_PINCH": "등을 펴려고 날개뼈를 모으고 힘을 줘요",
    "H_SHRUG": "일할 때 어깨에 힘이 들어가거나 올라가요",
    "H_SIDE_SCREEN": "옆에 있는 화면을 보려고 고개를 돌려요",
    "H_ELBOW": "한쪽 팔꿈치로 책상을 짚고 기대요",
    "H_OVERHEAD": "팔을 높이 들거나 멀리 뻗는 일이 많아요",
    "H_CARRY": "가방이나 물건을 오래 들고 있어요",
    "H_ARMS_CLOSE": "휴대폰이나 작은 물건을 몸 앞에 모아 사용해요",
    "H_CHEST_PUSH": "가슴 운동이나 물건을 미는 일을 자주 해요",
    "H_CLENCH": "집중하거나 긴장하면 이를 악물어요",
    "H_GRIND": "자는 동안 이를 갈거나 악무는 편이에요",
    "H_CHEW": "껌이나 질긴 음식을 오래 씹어요",
    "H_UNKNOWN": "잘 모르겠어요 / 해당하는 습관이 없어요"
  },
  "recentActions": {
    "R_SIT": "회의나 작업 때문에 오래 앉아 있었어요",
    "R_DRIVE": "운전을 오래 했어요",
    "R_COMPUTER_BOTH": "양팔을 앞에 두고 컴퓨터·노트북 작업을 오래 했어요",
    "R_ONE_HAND": "한쪽 손으로 마우스나 도구를 오래 사용했어요",
    "R_HEAD_TURN": "고개를 한쪽으로 돌리거나 같은 방향으로 오래 두었어요",
    "R_SHRUG": "어깨를 올리거나 힘을 준 채 일을 했어요",
    "R_BAG_CARRY": "가방을 한쪽 어깨에 오래 메고 있었어요",
    "R_OVERHEAD": "높은 곳을 정리하거나 팔을 위로·멀리 뻗는 일을 했어요",
    "R_HOLD_LOAD": "물건을 들거나 팔을 든 채 오래 버텼어요",
    "R_PHONE": "휴대폰을 보거나 작은 손작업을 오래 했어요",
    "R_PUSH_CHEST": "물건을 밀거나 가슴 운동을 했어요",
    "R_CLENCH": "집중하거나 긴장하면서 이를 악물었어요",
    "R_CHEW": "껌이나 질긴 음식을 오래 씹었어요",
    "R_NONE": "특별히 한 행동이 없어요",
    "R_UNKNOWN": "잘 기억나지 않아요"
  },
  "habitProfiles": {
    "head": [
      "H_SIDE_SCREEN",
      "H_SHRUG",
      "H_BOTH_FRONT",
      "H_CLENCH",
      "H_GRIND",
      "H_CHEW"
    ],
    "neck": [
      "H_SHRUG",
      "H_SIDE_SCREEN",
      "H_ELBOW",
      "H_CARRY",
      "H_BOTH_FRONT"
    ],
    "back": [
      "H_BOTH_FRONT",
      "H_ONE_FORWARD",
      "H_PINCH",
      "H_SHRUG",
      "H_SIDE_SCREEN",
      "H_OVERHEAD"
    ],
    "lower": [
      "H_SIT",
      "H_CROSS",
      "H_LEAN",
      "H_DRIVE"
    ],
    "shoulder": [
      "H_ONE_FORWARD",
      "H_BOTH_FRONT",
      "H_ARMS_CLOSE",
      "H_OVERHEAD",
      "H_CARRY",
      "H_SHRUG",
      "H_CHEST_PUSH"
    ]
  },
  "recentProfiles": {
    "head": [
      "R_HEAD_TURN",
      "R_COMPUTER_BOTH",
      "R_DRIVE",
      "R_CLENCH",
      "R_CHEW",
      "R_SHRUG"
    ],
    "neck": [
      "R_HEAD_TURN",
      "R_SHRUG",
      "R_BAG_CARRY",
      "R_HOLD_LOAD",
      "R_COMPUTER_BOTH"
    ],
    "back": [
      "R_COMPUTER_BOTH",
      "R_ONE_HAND",
      "R_HEAD_TURN",
      "R_OVERHEAD",
      "R_HOLD_LOAD",
      "R_PHONE"
    ],
    "lower": [
      "R_SIT",
      "R_DRIVE",
      "R_COMPUTER_BOTH",
      "R_PHONE"
    ],
    "shoulder": [
      "R_ONE_HAND",
      "R_COMPUTER_BOTH",
      "R_PHONE",
      "R_OVERHEAD",
      "R_HOLD_LOAD",
      "R_PUSH_CHEST",
      "R_HEAD_TURN",
      "R_SHRUG"
    ]
  },
  "compositeConditions": {
    "N": [
      [
        "R_HEAD_TURN"
      ],
      [
        "H_SIDE_SCREEN",
        "H_SHRUG"
      ]
    ],
    "O": [
      [
        "R_ONE_HAND"
      ],
      [
        "H_ONE_FORWARD"
      ]
    ],
    "U": [
      [
        "R_OVERHEAD"
      ]
    ],
    "L": [
      [
        "R_HOLD_LOAD"
      ]
    ],
    "P": [
      [
        "R_PHONE"
      ]
    ],
    "C": [
      [
        "R_PUSH_CHEST"
      ]
    ],
    "J": [
      [
        "R_CLENCH",
        "R_CHEW"
      ]
    ],
    "B": [
      [
        "R_COMPUTER_BOTH",
        "R_DRIVE"
      ]
    ],
    "H_JAW": [
      [
        "H_CLENCH",
        "H_GRIND",
        "H_CHEW"
      ]
    ],
    "H_NECK": [
      [
        "H_SIDE_SCREEN",
        "H_SHRUG",
        "H_ELBOW"
      ]
    ]
  },
  "rules": {
    "head": [
      {
        "id": "head-01",
        "when": [
          [
            "J"
          ]
        ],
        "routine": 10
      },
      {
        "id": "head-02",
        "when": [
          [
            "R_HEAD_TURN",
            "R_SHRUG"
          ]
        ],
        "routine": 9
      },
      {
        "id": "head-03",
        "when": [
          [
            "B"
          ],
          [
            "H_SIDE_SCREEN"
          ]
        ],
        "routine": 9
      },
      {
        "id": "head-04",
        "when": [
          [
            "H_JAW"
          ]
        ],
        "routine": 10
      },
      {
        "id": "head-05",
        "when": [
          [
            "H_SIDE_SCREEN",
            "H_SHRUG"
          ]
        ],
        "routine": 9
      },
      {
        "id": "head-06",
        "when": [
          [
            "ALWAYS"
          ]
        ],
        "routine": 10
      }
    ],
    "neck": [
      {
        "id": "neck-01",
        "when": [
          [
            "R_HEAD_TURN",
            "R_SHRUG"
          ]
        ],
        "routine": 3
      },
      {
        "id": "neck-02",
        "when": [
          [
            "L"
          ]
        ],
        "routine": 8
      },
      {
        "id": "neck-03",
        "when": [
          [
            "R_BAG_CARRY"
          ]
        ],
        "routine": 3
      },
      {
        "id": "neck-04",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ]
        ],
        "routine": 7
      },
      {
        "id": "neck-05",
        "when": [
          [
            "NR"
          ],
          [
            "H_NECK"
          ]
        ],
        "routine": 3
      },
      {
        "id": "neck-06",
        "when": [
          [
            "NR"
          ],
          [
            "H_CARRY"
          ]
        ],
        "routine": 8
      },
      {
        "id": "neck-07",
        "when": [
          [
            "ALWAYS"
          ]
        ],
        "routine": 3
      }
    ],
    "shoulder": [
      {
        "id": "shoulder-01",
        "when": [
          [
            "C"
          ]
        ],
        "routine": 11
      },
      {
        "id": "shoulder-02",
        "when": [
          [
            "R_HEAD_TURN",
            "R_SHRUG"
          ]
        ],
        "routine": 3
      },
      {
        "id": "shoulder-03",
        "when": [
          [
            "L"
          ]
        ],
        "routine": 8
      },
      {
        "id": "shoulder-04",
        "when": [
          [
            "U"
          ]
        ],
        "routine": 5
      },
      {
        "id": "shoulder-05",
        "when": [
          [
            "R_ONE_HAND"
          ]
        ],
        "routine": 4
      },
      {
        "id": "shoulder-06",
        "when": [
          [
            "P"
          ]
        ],
        "routine": 6
      },
      {
        "id": "shoulder-07",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ],
          [
            "H_ONE_FORWARD"
          ]
        ],
        "routine": 4
      },
      {
        "id": "shoulder-08",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ],
          [
            "H_BOTH_FRONT"
          ]
        ],
        "routine": 7
      },
      {
        "id": "shoulder-09",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ]
        ],
        "routine": 6
      },
      {
        "id": "shoulder-10",
        "when": [
          [
            "NR"
          ],
          [
            "H_CHEST_PUSH"
          ]
        ],
        "routine": 11
      },
      {
        "id": "shoulder-11",
        "when": [
          [
            "NR"
          ],
          [
            "H_ONE_FORWARD"
          ]
        ],
        "routine": 4
      },
      {
        "id": "shoulder-12",
        "when": [
          [
            "NR"
          ],
          [
            "H_OVERHEAD"
          ]
        ],
        "routine": 5
      },
      {
        "id": "shoulder-13",
        "when": [
          [
            "NR"
          ],
          [
            "H_CARRY"
          ]
        ],
        "routine": 8
      },
      {
        "id": "shoulder-14",
        "when": [
          [
            "NR"
          ],
          [
            "H_SHRUG"
          ]
        ],
        "routine": 3
      },
      {
        "id": "shoulder-15",
        "when": [
          [
            "NR"
          ],
          [
            "H_BOTH_FRONT"
          ]
        ],
        "routine": 7
      },
      {
        "id": "shoulder-16",
        "when": [
          [
            "NR"
          ],
          [
            "H_ARMS_CLOSE"
          ]
        ],
        "routine": 6
      },
      {
        "id": "shoulder-17",
        "when": [
          [
            "ALWAYS"
          ]
        ],
        "routine": 7
      }
    ],
    "back": [
      {
        "id": "back-01",
        "when": [
          [
            "N"
          ]
        ],
        "routine": 3
      },
      {
        "id": "back-02",
        "when": [
          [
            "O"
          ]
        ],
        "routine": 4
      },
      {
        "id": "back-03",
        "when": [
          [
            "U"
          ]
        ],
        "routine": 5
      },
      {
        "id": "back-04",
        "when": [
          [
            "L"
          ]
        ],
        "routine": 8
      },
      {
        "id": "back-05",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ],
          [
            "H_PINCH"
          ]
        ],
        "routine": 2
      },
      {
        "id": "back-06",
        "when": [
          [
            "P"
          ]
        ],
        "routine": 6
      },
      {
        "id": "back-07",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ],
          [
            "H_BOTH_FRONT"
          ]
        ],
        "routine": 7
      },
      {
        "id": "back-08",
        "when": [
          [
            "R_ONE_HAND"
          ]
        ],
        "routine": 6
      },
      {
        "id": "back-09",
        "when": [
          [
            "R_COMPUTER_BOTH"
          ]
        ],
        "routine": 2
      },
      {
        "id": "back-10",
        "when": [
          [
            "NR"
          ],
          [
            "H_ONE_FORWARD"
          ]
        ],
        "routine": 4
      },
      {
        "id": "back-11",
        "when": [
          [
            "NR"
          ],
          [
            "H_SIDE_SCREEN",
            "H_SHRUG"
          ]
        ],
        "routine": 3
      },
      {
        "id": "back-12",
        "when": [
          [
            "NR"
          ],
          [
            "H_OVERHEAD"
          ]
        ],
        "routine": 5
      },
      {
        "id": "back-13",
        "when": [
          [
            "NR"
          ],
          [
            "H_PINCH"
          ]
        ],
        "routine": 2
      },
      {
        "id": "back-14",
        "when": [
          [
            "NR"
          ],
          [
            "H_BOTH_FRONT"
          ]
        ],
        "routine": 7
      },
      {
        "id": "back-15",
        "when": [
          [
            "ALWAYS"
          ]
        ],
        "routine": 2
      }
    ],
    "lower": [
      {
        "id": "lower-01",
        "when": [
          [
            "ALWAYS"
          ]
        ],
        "routine": 1
      }
    ]
  },
  "allowedRoutines": {
    "head": [
      9,
      10
    ],
    "neck": [
      3,
      7,
      8
    ],
    "shoulder": [
      3,
      4,
      5,
      6,
      7,
      8,
      11
    ],
    "back": [
      2,
      3,
      4,
      5,
      6,
      7,
      8
    ],
    "lower": [
      1
    ]
  }
}
```

## 5. 추천 함수 참조 구현

다음 코드의 의미를 그대로 유지하며 기존 기술에 맞게 이식한다. `SPEC`는 위 JSON이다. 호출 전에 부위별 허용 ID와 특별 옵션 배타 규칙을 검증·정규화한다. 실제 결과의 동작 ID는 기존 저장소의 안정적인 ID와 연결하고 번호는 표시용으로 분리한다.

```js
function recommendFiveAreas({ bodyAreaId, habitIds = [], recentActionIds = [] }) {
  const h = new Set(habitIds), r = new Set(recentActionIds);
  const all = new Set([...h, ...r]);
  const matched = key => {
    if (key === "ALWAYS") return true;
    if (key === "NR") return r.size === 0 || r.has("R_NONE") || r.has("R_UNKNOWN");
    const groups = SPEC.compositeConditions[key];
    return groups ? groups.every(group => group.some(id => all.has(id))) : all.has(key);
  };
  const rules = SPEC.rules[bodyAreaId];
  if (!rules) throw new Error("Unsupported body area");
  const row = rules.find(rule => rule.when.every(group => group.some(matched)));
  if (!row) throw new Error("Uncovered input combination");
  // 추천 이유에는 이 분기에 실제로 사용된 입력만 넣는다.
  const used = new Set();
  const collect = key => {
    if (key === "ALWAYS" || key === "NR") return;
    const groups = SPEC.compositeConditions[key];
    if (groups) groups.forEach(group => group.filter(id => all.has(id)).forEach(id => used.add(id)));
    else if (all.has(key)) used.add(key);
  };
  row.when.forEach(group => group.filter(matched).forEach(collect));
  return {
    routineNumber: row.routine,
    ruleId: row.id,
    recommendationVersion: "jikkot11-v2-fiveareas",
    matchedHabitIds: [...used].filter(id => h.has(id)),
    matchedRecentActionIds: [...used].filter(id => r.has(id))
  };
}
```

## 6. 11개 동작·기존 이미지 연결

이미지와 동작 ID 연결

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

## 7. 추천 이유 문구

추천 이유 문구

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

## 8. 동작 수행 안내

동작 안내 텍스트 교체

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

## 9. 실제 프로그램 통합·과거 기록 보존

- 실제 질문 화면, 신체 그림, 추천 함수, 결과 화면, 동작 카드 및 대체 추천 경로까지 검색한다. 새 엔진을 만들기만 하고 화면이 옛 엔진을 호출하는 상태로 끝내지 않는다.
- 새 추천에는 `head / neck / shoulder / back / lower`의 다섯 부위 ID만 사용한다. 기존 ID를 그대로 재사용해야 한다면 단일 어댑터로 이 다섯 ID에 대응시키되 화면에는 세부 부위를 노출하지 않는다.
- 새 추천 버전은 `jikkot11-v2-fiveareas`다. 동작의 기존 안정적인 ID는 가능한 한 재사용하고 표시 번호와 구분한다. 기존에 잘못된 옛 동작과 ID가 충돌한다면 `jikkot11-r01` 등의 충돌 없는 ID로 연결한다.
- 과거 기록의 세부 부위·동작 ID·추천 문구·피드백은 삭제하거나 새 의미로 덮어쓰지 않는다. 과거 기록 표시와 새 추천 입력을 구분한다.
- 진행 상태 복원에서 이전 세부 부위 버전의 미완료 추천을 발견하면 그 추천 세션만 새 첫 질문으로 초기화한다. 로그인과 이미 저장된 기록은 유지한다.
- Firebase 저장 필드가 고정돼 있다면 최소한의 호환 확장으로 새 부위 ID와 추천 버전을 저장한다. 이용자 데이터의 일괄 초기화는 하지 않는다.
- 기존 회원/비회원 권한, 하루 체험 제한, 추천 표시 시 소진, 저장·기록·로그아웃·기존 메뉴는 유지한다.
- 기존 완료 후 피드백과 대체 추천 방식은 유지하되 해당 부위의 `allowedRoutines` 및 승인된 11개 안에서만 작동하도록 연결한다. 같은 동작 반복과 부위 밖 추천을 피한다. 다른 후보가 없는 허리는 기존 완료 흐름으로 이어지며 새 동작을 만들지 않는다.
- 추천 이유에는 선택한 사실 중 최종 분기에 사용된 정보만 넣는다. 내부 부위 프로필·규칙 ID·조건 코드·우선순위 표는 사용자 화면에 표시하지 않는다.
- 이미 설치된 11개 정적 이미지는 재사용한다. 새 이미지 첨부 없이 경로가 접근 가능하면 작업을 진행한다. 이미지가 없는 경우 접근 가능한 원본 PNG ZIP 또는 기존 작은 용량 이미지 묶음을 사용한다. 다른 코덱스 환경의 임시 작업 경로가 존재한다고 가정하지 않는다.
- 파일명과 실제 그림·동작을 대조하며 이미지를 한 번에 모두 읽어 큰 첨부 메시지를 만들지 않는다. 필요한 그림은 하나씩 확인하고 base64를 텍스트로 출력하지 않는다.
- 기존 GIF 전용 컴포넌트는 PNG/JPG도 지원하게 하며 이미지 전체가 잘리지 않도록 표시한다. 이미지 편집·재생성은 하지 않는다.
- 새 메뉴, 결제, 새 공급자, 새로운 콘텐츠는 추가하지 않는다.

## 10. 검증

아래 사례의 기대 결과를 테스트하고 실제 화면의 호출 경로에서도 같은 결과를 확인한다.

| 부위 | 습관 | 최근 행동 | 동작 |
|---|---|---|---|
| lower | H_SIT | R_DRIVE | 1 |
| back | H_PINCH | R_COMPUTER_BOTH | 2 |
| neck | H_SIDE_SCREEN | R_HEAD_TURN | 3 |
| shoulder | H_ONE_FORWARD | R_ONE_HAND | 4 |
| back | H_OVERHEAD | R_OVERHEAD | 5 |
| shoulder | H_ARMS_CLOSE | R_PHONE | 6 |
| shoulder | H_BOTH_FRONT | R_COMPUTER_BOTH | 7 |
| shoulder | H_CARRY | R_HOLD_LOAD | 8 |
| head | H_SIDE_SCREEN | R_HEAD_TURN | 9 |
| head | H_CLENCH | R_CLENCH | 10 |
| shoulder | H_CHEST_PUSH | R_PUSH_CHEST | 11 |
| head | H_SIDE_SCREEN, H_CLENCH | R_HEAD_TURN, R_CLENCH | 10 |
| shoulder | H_ONE_FORWARD, H_CHEST_PUSH | R_ONE_HAND, R_PUSH_CHEST | 11 |
| shoulder | H_CARRY, H_SHRUG | R_HOLD_LOAD, R_HEAD_TURN | 3 |
| back | H_ONE_FORWARD, H_OVERHEAD | R_ONE_HAND, R_OVERHEAD | 4 |
| back | H_SHRUG, H_OVERHEAD | R_HEAD_TURN, R_OVERHEAD | 3 |
| back | H_PINCH, H_BOTH_FRONT | R_COMPUTER_BOTH | 2 |
| shoulder | H_ONE_FORWARD, H_BOTH_FRONT | R_COMPUTER_BOTH | 4 |
| shoulder | H_CHEST_PUSH | R_NONE | 11 |
| back | H_ONE_FORWARD | R_UNKNOWN | 4 |
| back | H_ONE_FORWARD | R_HEAD_TURN | 2 |
| head | H_CLENCH | R_COMPUTER_BOTH | 10 |
| head | H_CLENCH, H_SIDE_SCREEN | R_COMPUTER_BOTH | 9 |
| neck | H_CARRY | R_NONE | 8 |
| head | H_UNKNOWN | R_UNKNOWN | 10 |
| neck | H_UNKNOWN | R_UNKNOWN | 3 |
| shoulder | H_UNKNOWN | R_UNKNOWN | 7 |
| back | H_UNKNOWN | R_UNKNOWN | 2 |
| lower | H_UNKNOWN | R_UNKNOWN | 1 |

필수 검증:

- 위 프로필과 특별 옵션의 배타 규칙으로 만들 수 있는 전체 **42,544개 유효 조합**을 열거해 정확히 동작 하나가 반환되는지 확인한다. UI 목록을 이 문서와 다르게 변경해서 조합 수가 달라지도록 하지 않는다.
- 결과가 허용 범위 안인지, 1~11번이 모두 실제 입력에서 도달 가능한지, 모든 선언된 분기가 적어도 한 조합에서 실행되는지 확인한다.
- 입력 배열의 순서와 중복이 결과를 바꾸지 않는지 확인한다. 복수 선택을 단일 선택으로 몰래 바꾸지 않는다.
- 새 부위 선택지가 다섯 개뿐인지 확인한다. 세부 위치 선택·숨은 옛 입력·네 번째 추천 질문이 없는지 확인한다.
- 특별 옵션 배타 처리, 뒤로 가서 수정한 답변 초기화, 오래된 진행 상태 복원, 과거 기록 보존을 확인한다.
- 11개 제목·설명·이미지가 일치하는지 확인한다. 정적 이미지의 실제 배포 경로가 200으로 응답하는지 확인한다.
- 프로젝트의 관련 로직 테스트, 빌드, 타입 검사, 린트를 실행한다. 기존에 이미 실패한 검사라면 해당 실패와 이번 변경을 구분하고 이번 변경으로 발생한 실패는 해결한다.
- 실제 브라우저에서 주요 경로를 확인한다. 최소한 어깨의 한손 작업→4번 / 물건 밀기→11번 / 컴퓨터 작업→7번 경로와 머리·목·등·허리 기본 경로를 확인한다.

## 11. 기존 사이트로 실제 배포까지 완료

이 요청은 실제 배포를 포함한다. 로컬 빌드 성공만으로 완료 보고하지 않는다.

1. 현재 Git 원격, 운영 브랜치, Cloudflare 프로젝트·배포 방식, 연결된 기존 도메인, Firebase 설정을 확인한다. `jikkot.pages.dev`는 기존 사용 주소 중 하나이므로 현재 유효한 운영 주소를 실제 설정으로 확인한다.
2. 다른 사람의 작업·미커밋 변경을 보존한다. 작업 범위의 변경만 정리하고, 필요한 커밋·푸시를 수행한다. 기록을 지우는 강제 푸시나 관련 없는 파일 교체는 하지 않는다.
3. 기존 Git 연동 배포라면 올바른 운영 브랜치에 반영한 뒤 배포 작업이 성공할 때까지 확인한다. 기존 직접 배포 경로라면 그 설정과 자격 증명을 사용한다. 배포 완료 상태와 소스 커밋을 대조한다.
4. 이번 변경에 Firebase 규칙·인덱스·함수 배포가 실제로 필요할 때만 기존 프로젝트에 필요한 항목을 배포한다. 프론트엔드 변경뿐이라면 불필요한 백엔드 배포를 추가하지 않는다. 기존 데이터와 권한을 보존한다.
5. 기존 도메인에서 서비스가 정상 응답하는지 확인하고, 배포된 프로그램을 직접 열어 다섯 부위·세 질문·대표 추천·이미지 표시를 검증한다. 로컬 검사와 배포 후 검사를 구분해 기록한다.
6. 버전·응답·배포 커밋 등의 확인 가능한 근거로 새 배포가 서비스 중인지 확인한다. 기존 화면을 본 뒤 캐시 문제라고 가정하고 완료 처리하지 않는다.
7. 운영 반영이 실패하면 원인을 해결하고 다시 검증한다. 서비스가 깨진 배포라면 기존 정상 배포 복원 수단을 사용해 이용 가능한 상태를 확보한다. 목표 변경의 배포를 완료하지 못했으면 그 사실을 명확히 보고한다.

배포에 필요한 접근이 없다면 계정·프로젝트·명령·누락된 권한을 구체적으로 알려준다. 비밀 키나 토큰을 채팅에 노출하지 않는다. 접근 부족을 이유로 구현·검증을 생략하거나, 성공하지 않은 푸시·배포를 성공했다고 쓰지 않는다. 새 유료 서비스 가입이나 요금제 변경은 이번 구현에 임의로 추가하지 않는다.

## 12. 완료 보고

최종 보고는 다음만 간단히 적는다.

- 다섯 부위와 세 질문이 실제 화면에 반영됐는지.
- 교체한 추천 호출 경로와 핵심 변경 파일.
- 실제 실행한 테스트·빌드 결과, 전체 조합 검사 결과.
- 11개 이미지 연결과 과거 기록 호환 여부.
- 실제 배포 URL, 배포 커밋·버전, 배포 성공 상태.
- 배포 후 확인한 추천 경로와 결과.
- 완료하지 못한 항목이 있다면 그 항목과 정확한 장애 원인.

설계 제안이나 배포 명령 안내만 남기고 끝내지 말고, 위 명세를 현재 프로그램에 구현하고 기존 운영 사이트 반영까지 완료해줘.
