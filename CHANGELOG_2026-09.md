# MarineVision AI — Upgrade pass (this session)

This upgrade builds on the existing repository (already NestJS/MongoDB +
React/Cesium/Leaflet, already honest about not having a trained sonar
detector). Nothing below was invented or faked — every change is real code
against the existing modules, and every AI-adjacent claim is labelled
according to what it actually is.

## 1. Security fix — operator could modify the authoritative map
`PATCH /api/anomalies/:id` (backend) had no role guard at all, even though
`/api/detections/:id/verify` and `/reject` were already correctly
admin-gated. The Global Earth / Anomaly Panel "Verify" and "Reject" buttons
called the ungated endpoint, so an operator could mark their own detections
verified/rejected directly — a direct violation of "operator must never
modify the authoritative globe/database."

- `backend/src/modules/detections/anomalies.controller.ts`: `PATCH :id` now
  throws `403 INSUFFICIENT_PERMISSIONS` for any non-admin caller.
- `frontend/src/components/AnomalyPanel.tsx`: Verify/Reject buttons are now
  only rendered for `role === 'ADMIN'`; operators see a read-only notice
  instead. (Defense in depth — the real enforcement is server-side.)

## 2. "Wrong image" / sonar-domain protection (spec section 12)
There was previously no check at all for whether an uploaded file was
actually side-scan sonar imagery — a selfie or screenshot would have gone
straight into the placeholder detector.

- `backend/src/modules/ai-inference/ai-inference.service.ts`: new
  `assessSonarDomainValidity()`. This is **not a trained classifier** — no
  labelled sonar-vs-photo corpus was available to train one. It is a
  deterministic, explainable heuristic computed from real pixel statistics:
  colour saturation (sonar is near-grayscale), local-variance "speckle"
  texture (sonar has a persistent noise floor; photos have large smooth
  regions), row-wise banding (per-ping normalisation artifact), and aspect
  ratio (sonar swaths are usually far more elongated than camera photos).
  Deliberately conservative — biased toward *not* blocking borderline
  frames.
- `backend/src/modules/sonar/sonar-processing.service.ts`: runs this check
  first in the pipeline. If the image doesn't look like sonar, the frame is
  marked `processingStatus: 'INVALID_INPUT'`, the reasons are stored, a
  `frame_invalid_input` realtime event fires, and the frame is skipped —
  never reaches the detector, never gets treated as a trusted training
  sample.
- `backend/src/modules/sonar/schemas/sonar-frame.schema.ts`: added
  `INVALID_INPUT` to `processingStatus`, and a `domainValidity` field
  storing `{ isSonarLike, sonarProbability, reasons, metrics }`.
- Frontend (`SonarFramePage.tsx`, `SurveyDetailPage.tsx`,
  `types/index.ts`): surfaces an "⚠ INVALID INPUT — this image does not
  appear to contain Side-Scan Sonar imagery" banner with the sonar
  probability and reasons, per the spec's exact wording.

## 3. Operator uploads vs. admin-trusted uploads
Previously every uploaded frame was treated identically regardless of who
uploaded it. Per spec section 11, operator-submitted images must reach
admin review before they can ever enter the training dataset.

- `backend/src/modules/sonar/schemas/sonar-frame.schema.ts`: added
  `uploadedByRole` (`ADMIN`/`OPERATOR`), `uploadedByUserId`, and
  `reviewStatus` (`APPROVED`/`PENDING_REVIEW`/`REJECTED`/`CORRECTED`).
- `backend/src/modules/sonar/sonar.controller.ts`: admin uploads are
  `reviewStatus: 'APPROVED'` immediately; operator uploads are always
  `PENDING_REVIEW`. (The admin-only dataset endpoints in
  `ai-training.controller.ts` were already `@Roles('ADMIN')`-gated, so
  combined with this flag an admin can filter to only pull approved,
  human-reviewed frames into `training_dataset`.)
- Frontend surfaces a `PENDING REVIEW` / `REJECTED` / `CORRECTED` badge next
  to each frame in the survey frame list.

## 4. Globe on the operator dashboard
The `/globe` route already existed and was already correctly read-only for
operators (`GlobePage.tsx` already computed `readOnly = role === 'OPERATOR'`
for the mutation controls that exist), but it was missing from the operator
sidebar entirely, so operators had no way to reach it.

- `frontend/src/components/Layout.tsx`: added "Global 3D Earth" to
  `NAV_ITEMS_OPERATOR`.

## 5. Branding / logo
- New `frontend/public/logo.svg`: a custom sonar-sweep emblem (range rings,
  a sweep wedge, and a detected-contact blip), replacing the generic
  Lucide "Radar" icon used as a stand-in logo.
- Wired in as the favicon (`index.html`), the sidebar mark (`Layout.tsx`),
  and the login-screen mark (`LoginPage.tsx`).

## What this does NOT include, and why
- **No trained YOLO/ONNX model.** No labelled side-scan-sonar dataset was
  supplied in this session, and there's no GPU in this environment. The
  detector remains the existing, explicitly-labelled
  `placeholder-heuristic-v0` (grid contrast/shadow heuristic over real
  pixel data — not a neural network). Drop a trained `.onnx` model at
  `ONNX_MODEL_PATH` and the existing loader in `ai-inference.service.ts`
  will pick it up automatically; no other code changes are required as
  long as the output follows the standard YOLO tensor layout assumed in
  `parseYoloOutput()`.
- **No fabricated accuracy, coordinates, or historical records** were
  added anywhere, consistent with the project's existing "no mock data for
  live AI results" rule.
- **No `npm install` / build verification** could be run in this session —
  outbound network access is disabled in this container (`npm` returned
  `403 Forbidden` against the registry). Every edit was manually checked
  for balanced braces/parens and correct TypeScript typing against the
  existing schemas/services, but you should run `npm ci && npm run build`
  in both `backend/` and `frontend/` on your machine before deploying.

## Suggested next steps (real model training)
The 15 `DM_Wilson_*.png` side-scan images and the two GIS/detector
screenshots you attached are useful as **visual references and UI targets**
(they're already what the app produces), but 15 images is far too small a
set to train a YOLO/U-Net detector on. To get a real trained model:
1. Label the images you have (and more — you'll want hundreds to low
   thousands of annotated frames per class) with a tool like CVAT or
   Roboflow, using the class list in `ai-inference.service.ts`
   (`DETECTION_CLASSES`).
2. Split by survey line, not randomly, to avoid near-duplicate frames
   leaking between train/val/test (the dataset service already supports
   this split logic).
3. Train YOLOv8 (or similar) outside this environment (needs a GPU),
   export to ONNX, and drop it at `ONNX_MODEL_PATH`.
4. Use the existing `/api/admin/training/*` endpoints to evaluate
   (precision/recall/F1/mAP against a real held-out test split) before
   publishing a model version — the pipeline for this already exists in
   `ai-training.service.ts` / `model-versions.service.ts`.
