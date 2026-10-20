#!/usr/bin/env python3
"""Build the public procedure-title index from published Firestore documents.

Requires FIREBASE_SERVICE_ACCOUNT_JSON (service-account JSON). The project ID
can be overridden via FIREBASE_PROJECT_ID. Writes ONLY document IDs and titles.
"""
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = ROOT / "procedures-index.json"
SCOPES = ["https://www.googleapis.com/auth/datastore"]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "").strip() or "iraq-law-test"
    if not raw:
        fail("Set FIREBASE_SERVICE_ACCOUNT_JSON in GitHub Actions secrets. The default project ID is iraq-law-test.")

    try:
        service_info = json.loads(raw)
        credentials = service_account.Credentials.from_service_account_info(service_info, scopes=SCOPES)
    except Exception as exc:
        fail(f"Invalid service-account JSON: {exc}")

    credentials.refresh(Request())
    url = f"https://firestore.googleapis.com/v1/projects/{quote(project_id, safe='')}/databases/(default)/documents:runQuery"
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "legalProcedures"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "published"},
                    "op": "EQUAL",
                    "value": {"booleanValue": True}
                }
            },
            "select": {"fields": [{"fieldPath": "title"}]}
        }
    }
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {credentials.token}", "Content-Type": "application/json"},
        json=body,
        timeout=30,
    )
    if not response.ok:
        fail(f"Firestore query failed ({response.status_code}): {response.text[:500]}")

    result = []
    for row in response.json():
        if row.get("error"):
            fail(f"Firestore query returned an error: {row['error']}")
        document = row.get("document")
        if not document:
            continue
        fields = document.get("fields", {})
        title = fields.get("title", {}).get("stringValue", "").strip()
        name = document.get("name", "")
        doc_id = name.rsplit("/", 1)[-1]
        if doc_id and title:
            result.append({"id": doc_id, "title": title})

    result.sort(key=lambda item: item["title"])
    content = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    previous = INDEX_PATH.read_text(encoding="utf-8") if INDEX_PATH.exists() else ""
    if content != previous:
        INDEX_PATH.write_text(content, encoding="utf-8")
        print(f"Updated public procedure index: {len(result)} published title(s).")
    else:
        print(f"Procedure index is already current: {len(result)} published title(s).")


if __name__ == "__main__":
    main()
