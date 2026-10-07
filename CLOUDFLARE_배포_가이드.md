# Cloudflare 배포 안내

새 앱은 Firebase 인증·Firestore·Functions를 사용합니다. 기존 D1 원격 migration 배포를 실행하지 마세요. 기존 데이터베이스는 삭제하지 않았으며 회원 이전은 별도 작업입니다.

실제 순서는 [통합 배포·도메인 연결 가이드](docs/deployment-guide-ko.md)를 따릅니다. 검토 Worker `jikkot-review`와 운영 Worker `jikkot-ver9`를 분리하고, Firebase 프로젝트도 분리하세요. 현재 운영 배포 완료를 뜻하지 않습니다.
