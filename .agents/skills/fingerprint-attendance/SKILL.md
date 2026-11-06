---
name: fingerprint-attendance
description: Develop, review, or document this ESP32 fingerprint attendance project, including its embedded web UI, Google Apps Script API, Google Sheets data model, class import, synchronization, and performance work. Use for changes inside this repository; do not assume a multi-device deployment unless explicitly requested.
---

# Fingerprint attendance project

Preserve the project's existing hardware flow while evolving it from one class to multiple classes. Google Sheets remains the source of truth and Google Apps Script is the API layer. The current deployment has one physical ESP32 device.

## Read the relevant context

- Read the root `README.md` for current scope and file map.
- For system boundaries or data flow changes, read `docs/ARCHITECTURE.md`.
- For Google Sheets, identifiers, JSON, or import work, read `docs/DATA_MODEL.md`.
- For starting/closing attendance sessions, absence calculation, or weekly reports, read `docs/ATTENDANCE_WORKFLOW.md`.
- For UI lag, polling, memory, or blocking behavior, read `docs/PERFORMANCE.md`.
- For sequencing or deciding what to implement next, read `docs/DEVELOPMENT_PLAN.md`.

Do not load every document for a narrow edit.

## Non-obvious constraints

- Treat `script_google_sheet.h` as Google Apps Script source/reference. It is not included by the Arduino sketch.
- Preserve registered fingerprints. Any change to `/fingerlist.json` or student keys needs a backward-compatible migration path.
- Use a persistent active class for this single device. Do not build device fleet management unless the scope changes.
- Prefer a globally unique `studentId`. If existing student codes may repeat between classes, use `classId|studentCode` as the local key.
- Keep heavy administration, file import, and reporting on the Apps Script web UI. Keep the ESP32 UI focused on device status, active class, attendance session, fingerprint enrollment, and sync state.
- Mutating API actions should use JSON and POST. Make attendance writes idempotent.
- Starting a session snapshots the active class roster as `PENDING`. Only closing the session converts remaining `PENDING` rows to final `ABSENT` records.
- Do not add new secrets to source files or documentation. Configuration examples must use placeholders.

## Performance invariants

- Do not reload full lists on a fixed short browser interval. Refresh on explicit action, data-version change, or WebSocket notification.
- Do not reopen and deserialize the same LittleFS JSON file once per student. Parse once per request or keep a cache invalidated after sync.
- Avoid long `delay()` calls and blocking Google requests in web request handlers. Keep `webServer.handleClient()` and `webSocket.loop()` responsive.
- Synchronize only the active class where practical. Use a revision/version check before transferring a full roster.
- Process imports and large writes in bounded batches.

## Change workflow

1. Inspect the sketch, the relevant page header, and Apps Script path before editing a cross-layer feature.
2. State whether the change affects the device, Apps Script deployment, Google Sheet schema, or stored LittleFS data.
3. Add migration handling before changing persisted formats.
4. Verify the Arduino build for firmware changes. Validate Apps Script syntax separately for script changes.
5. Test the single-device happy path plus Wi-Fi failure, duplicate scan, restart, and invalid data when those paths are affected.

Keep documentation aligned with implemented behavior. Mark target designs as planned until the code and deployed Apps Script support them.
