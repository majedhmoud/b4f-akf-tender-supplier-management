---
status: accepted
---

# Store uploaded files on local disk for the hackathon

## Context

The platform stores Terms of Reference, sign-up documents, and bid files. [Standards §2.5](../../04_RULES/ENGINEERING_STANDARDS.md#25-file-upload-security) asks for private object storage, and [standards §5](../../04_RULES/ENGINEERING_STANDARDS.md#5-scalability-and-reliability) says to store uploaded files outside the application server's local filesystem. [ADR 0004](0004_TECHNOLOGY_STACK.md) names no storage tool. The product is presented to our instructors on Day 4 and is not deployed or shipped. A deployment would need many other changes anyway.

## Decision

- Files are stored in a private local directory on the API server, set by `FILE_STORAGE_DIR` in `backend/.env` and listed in `.gitignore`. It is never served as a static folder.
- Modules use a storage adapter (`save`, `delete`, `getSignedUrl`) and never touch file paths. [Standards §1.2](../../04_RULES/ENGINEERING_STANDARDS.md#12-separation-of-concerns) already requires external integrations behind adapters.
- File names on disk are the random, server-generated `storage_key` ([ERD](../ERD.md#document-ownership)).
- Download endpoints return a short-lived signed URL that the API itself serves. The signature covers the storage key, the download file name, and an expiry of 5 minutes. An invalid or expired URL returns `404`.
- This is an accepted exception to standards §2.5 and §5, for the hackathon only.

## Consequences

- No new tool to set up or learn.
- File bytes pass through the API. The [architecture](../ARCHITECTURE.md) and [API contract §1.8](../API_CONTRACT.md#18-files) stay valid, with the API, not object storage, serving the signed URL.
- Files are lost if the directory is deleted. Seed data recreates the demo files.
- Before any deployment, replace the adapter with private object storage, such as an S3-compatible service, and withdraw this exception. No module changes.
