// Ordered SPEC from docs/five-areas-request.md. Keep IDs separate from UI labels.
export const fiveAreasSpec = {
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
} as const;
