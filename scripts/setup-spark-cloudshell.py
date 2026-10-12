"""Prepare the existing jikkot Spark backend in an authenticated Cloud Shell.

No Firebase CLI login, billing change, Functions, Storage or TTL is required.
The private key is written only to an ignored local file, never stdout.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

PROJECT = "jikkot"
PROJECT_NUMBER = "252288368957"
ACCOUNT = f"jikkot-api@{PROJECT}.iam.gserviceaccount.com"
ROOT = Path(__file__).resolve().parent.parent


class SetupError(Exception):
    pass


def gcloud(*arguments, optional=False):
    command = ["gcloud", *arguments, "--project", PROJECT, "--quiet"]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode:
        if optional and ("NOT_FOUND" in result.stderr or "not found" in result.stderr.lower()):
            return None
        # Command arguments never contain tokens. Avoid echoing SDK/API bodies.
        raise SetupError(f"Google Cloud 작업 실패: {' '.join(arguments[:3])}. 계정의 jikkot 프로젝트 권한을 확인해주세요.")
    return result.stdout.strip()


def validate_key(path):
    if path.is_symlink():
        raise SetupError("키 파일의 심볼릭 링크는 사용할 수 없습니다.")
    data = json.loads(path.read_text())
    if (
        data.get("type") != "service_account"
        or data.get("project_id") != PROJECT
        or data.get("client_email") != ACCOUNT
        or not data.get("private_key", "").startswith("-----BEGIN PRIVATE KEY-----")
    ):
        raise SetupError("기존 키가 jikkot-api 계정과 일치하지 않습니다. 기존 파일은 변경하지 않았습니다.")
    path.chmod(0o600)


def rules_api(token, path, method="GET", body=None, optional=False):
    request = urllib.request.Request(
        f"https://firebaserules.googleapis.com/v1/{path}",
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if optional and error.code == 404:
            return None
        raise SetupError(f"Firestore 규칙 작업 실패(HTTP {error.code}). 비밀 정보는 출력하지 않았습니다.") from None


def apply_setup(root=ROOT):
    os.umask(0o077)
    outputs = root / "outputs"
    key_file = outputs / "firebase-worker-service-account.json"
    if outputs.is_symlink() or key_file.is_symlink():
        raise SetupError("키 저장 경로에 심볼릭 링크가 있습니다. 경로를 확인해주세요.")
    if key_file.exists():
        validate_key(key_file)  # Check before making any remote changes.
    account = gcloud("auth", "list", "--filter=status:ACTIVE", "--format=value(account)")
    if not account:
        raise SetupError("Google 계정 인증이 필요합니다. Google Cloud Shell에서 실행하고 요청되는 계정 접근을 승인해주세요.")
    project = json.loads(gcloud("projects", "describe", PROJECT, "--format=json"))
    if project.get("projectId") != PROJECT or str(project.get("projectNumber")) != PROJECT_NUMBER:
        raise SetupError("프로젝트가 등록된 jikkot 웹 앱과 일치하지 않습니다. 작업을 중단했습니다.")
    gcloud("services", "enable", "iam.googleapis.com", "firestore.googleapis.com", "firebaserules.googleapis.com")
    print("1/4 기존 jikkot 프로젝트와 Google 계정 접근 확인 완료")
    if gcloud("iam", "service-accounts", "describe", ACCOUNT, "--format=json", optional=True) is None:
        gcloud("iam", "service-accounts", "create", "jikkot-api", "--display-name=Jikkot Worker Firestore access")
    gcloud("projects", "add-iam-policy-binding", PROJECT,
           "--member", f"serviceAccount:{ACCOUNT}", "--role", "roles/datastore.user", "--condition=None")
    print("2/4 jikkot-api에 Firestore 데이터 사용자 권한 연결 완료")
    database = gcloud("firestore", "databases", "describe", "--database=(default)", "--format=json", optional=True)
    if database is None:
        gcloud("firestore", "databases", "create", "--database=(default)", "--location=asia-northeast3", "--type=firestore-native")
    else:
        metadata = json.loads(database)
        if metadata.get("type") != "FIRESTORE_NATIVE":
            raise SetupError("기존 데이터베이스가 Firestore Native가 아닙니다. 기존 데이터는 변경하지 않았습니다.")
    outputs.mkdir(mode=0o700, exist_ok=True)
    token = gcloud("auth", "print-access-token")  # Kept in memory, never printed.
    release_path = f"projects/{PROJECT}/releases/cloud.firestore"
    prior = rules_api(token, release_path, optional=True)
    current_rules = (root / "firestore.rules").read_text()
    previous_rules = rules_api(token, prior["rulesetName"]) if prior else None
    if previous_rules:
        (outputs / "firestore-rules-before-setup.json").write_text(json.dumps(previous_rules, indent=2) + "\n")
    prior_source = [file.get("content") for file in (previous_rules or {}).get("source", {}).get("files", [])]
    if prior_source != [current_rules]:
        ruleset = rules_api(token, f"projects/{PROJECT}/rulesets", "POST",
                            {"source": {"files": [{"name": "firestore.rules", "content": current_rules}]}})
        release = {"name": release_path, "rulesetName": ruleset["name"]}
        if prior:
            rules_api(token, release_path, "PATCH", {"release": release, "updateMask": "rulesetName"})
        else:
            rules_api(token, f"projects/{PROJECT}/releases", "POST", release)
    # There are no composite indexes. TTL field overrides are omitted on Spark.
    print("3/4 기존 데이터 보존, Firestore 기본 DB와 서버 전용 규칙 준비 완료")
    if not key_file.exists():
        temporary = outputs / f".firebase-worker-key-{os.getpid()}.json"
        if temporary.exists() or temporary.is_symlink():
            raise SetupError("임시 키 파일 경로가 이미 존재합니다. 덮어쓰지 않았습니다.")
        gcloud("iam", "service-accounts", "keys", "create", str(temporary), "--iam-account", ACCOUNT)
        validate_key(temporary)
        if key_file.exists():
            raise SetupError("다른 작업이 키 파일을 만들었습니다. 덮어쓰지 않았습니다.")
        # Atomic no-overwrite publication, including concurrent setup runs.
        os.link(temporary, key_file)
        temporary.unlink()
    validate_key(key_file)
    receipt = {"projectId": PROJECT, "serviceAccount": ACCOUNT, "role": "roles/datastore.user",
               "database": "(default)", "keyFile": str(key_file), "billingChanged": False,
               "functionsDeployed": False, "ttlEnabled": False}
    (outputs / "firebase-server-setup-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print("4/4 서버 키 준비 완료. 키 본문은 출력하지 않았습니다.")
    print(f"Cloud Shell 파일: {key_file}")
    print("이 파일 전체를 Cloudflare jikkot의 FIREBASE_SERVICE_ACCOUNT Secret에만 등록하세요. 채팅이나 Git에는 넣지 마세요.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="인증된 본인 Cloud Shell에서 기존 프로젝트 설정 적용")
    args = parser.parse_args()
    if not args.apply:
        print(json.dumps({"project": PROJECT, "account": ACCOUNT, "role": "roles/datastore.user",
                          "databaseIfMissing": "(default), asia-northeast3, Firestore Native",
                          "rules": "firestore.rules", "key": "outputs/firebase-worker-service-account.json",
                          "billingChange": False, "ttl": False, "functions": False}, ensure_ascii=False, indent=2))
        return
    try:
        apply_setup()
    except (SetupError, OSError, json.JSONDecodeError) as error:
        print(f"설정 중단: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
