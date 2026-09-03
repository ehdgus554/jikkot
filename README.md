# 직꼿 VER9.1

직장인이 현재 가능한 움직임, 큰 불편 부위, 최근 행동과 생활습관을 선택하면 사진 루틴 3개를 제안하는 서버형 시제품입니다.

## 브라우저에서 Cloudflare에 배포

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ehdgus554/jikkot)

위 버튼을 누르면 Cloudflare가 다음 항목을 자동으로 준비합니다.

- 직꼿 VER9.1 Worker와 정적 이미지
- 회원정보를 저장할 D1 데이터베이스
- 회원·세션·비회원 일일 이용 기록 테이블
- GitHub 저장소와 이후 자동 배포 연결

자세한 화면별 순서는 [`CLOUDFLARE_배포_가이드.md`](./CLOUDFLARE_배포_가이드.md)를 확인하세요.

## 주요 기능

- 가능한 움직임 → 큰 불편 부위 → 부위별 최근 행동 → 부위별 생활습관 → 루틴 추천
- 머리·목·어깨·허리·골반·엉덩이 동작 후보 30개
- 아이디·비밀번호 회원가입과 로그인
- 비밀번호 PBKDF2 해시·솔트 저장
- 회원 등급 필드: `member`, `lifetime`, `admin`
- 로그인 회원은 시제품 후보 30개 전체 열람
- 비회원은 한국 시간 기준 하루 1개 루틴 상세 열람
- Cloudflare D1 기반 회원·세션·이용 기록 저장

## 현재 범위

- 모든 사진, 동작과 추천 연결은 검수 전 시제품 콘텐츠입니다.
- 비회원이 쿠키를 삭제하거나 다른 브라우저·기기를 사용하면 새 방문자로 인식될 수 있습니다.
- 카카오·네이버 로그인과 휴대전화 인증은 포함하지 않았습니다.
- 로그인 시도 제한, 계정 복구, 회원 탈퇴·파기 흐름은 실서비스 전에 추가해야 합니다.
- 이 추천은 질환 진단이나 치료를 대신하지 않습니다.

## 로컬 개발

```bash
npm ci
npm run dev
```

## 검증

```bash
npm test
npm run lint
```
