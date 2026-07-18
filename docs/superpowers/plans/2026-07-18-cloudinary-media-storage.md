# Cloudinary Media Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store every new Walai Booking image in Cloudinary so payment slips, avatars, and catalog images survive Render restarts and deployments.

**Architecture:** Existing multipart endpoints remain unchanged, but shared Multer middleware keeps validated images in memory. A focused Cloudinary service uploads buffers and performs best-effort cleanup; controllers store returned HTTPS URLs in existing string columns. Legacy `/uploads/...` resolution remains available during transition.

**Tech Stack:** Express, TypeScript strict mode, Multer memory storage, Cloudinary Node SDK, PostgreSQL, Node built-in test runner.

## Global Constraints

- Preserve current endpoint paths, multipart field names, response shapes, authorization, and file-size limits.
- Every new or changed TypeScript function has an explicit return type and does not use `any`.
- Never expose Cloudinary credentials, stack traces, or provider response bodies to API clients.
- New Cloudinary folders are `walai-booking/slips`, `walai-booking/avatars`, and `walai-booking/catalog`.
- Full Cloudinary HTTPS URLs are stored in existing DB columns; no schema migration.
- Keep legacy `/uploads` static serving and frontend URL resolution during transition.
- Existing Render-local files that are already missing cannot be recovered.

---

### Task 1: Cloudinary service and provider tests

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Create: `backend/src/services/cloudinary.service.ts`
- Create: `backend/src/services/cloudinary.service.test.ts`

**Interfaces:**
- Produces: `uploadImage(buffer: Buffer, options: CloudinaryUploadOptions): Promise<CloudinaryUploadResult>`
- Produces: `deleteCloudinaryImage(url?: string | null): Promise<void>`
- Produces: `extractCloudinaryPublicId(url: string): string | null`
- `CloudinaryUploadOptions` contains `folder: CloudinaryFolder` and optional `publicId?: string`
- `CloudinaryUploadResult` contains `url: string` and `publicId: string`

- [ ] **Step 1: Add failing pure-helper tests**
  - Use `node:test` and `node:assert/strict`.
  - Arrange Cloudinary versioned URLs, non-Cloudinary URLs, and URL-encoded public IDs.
  - Act with `extractCloudinaryPublicId`.
  - Assert one behavior concept per test.

- [ ] **Step 2: Run test and confirm RED**
  - Command: `node --test -r ts-node/register src/services/cloudinary.service.test.ts`
  - Expected: module/export missing.

- [ ] **Step 3: Install latest Cloudinary SDK**
  - Command in `backend/`: `npm install cloudinary`
  - Do not manually invent a dependency version.

- [ ] **Step 4: Implement service**
  - Configure `cloudinary.v2` from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.
  - Validate required env only when upload/delete is invoked so pure helper tests do not need credentials.
  - Wrap `cloudinary.uploader.upload_stream` in a typed Promise.
  - Set `resource_type: 'image'`, requested folder, optional public ID, `overwrite: true`, and `invalidate: true`.
  - Reject an upload result that lacks `secure_url` or `public_id`.
  - Extract public ID only from `res.cloudinary.com` image upload URLs.
  - Make delete idempotent and ignore legacy/local/external URLs.

- [ ] **Step 5: Run tests and confirm GREEN**
  - Command: `node --test -r ts-node/register src/services/cloudinary.service.test.ts`

---

### Task 2: Shared in-memory image middleware and generic catalog upload

**Files:**
- Create: `backend/src/middleware/image-upload.middleware.ts`
- Modify: `backend/src/routes/upload.routes.ts`

**Interfaces:**
- Produces: `createImageUpload(maxFileSizeBytes: number): multer.Multer`
- Consumes: `uploadImage` from Task 1
- Preserves: `POST /api/uploads/image`, multipart field `image`, response `{ success: true, data: { url } }`

- [ ] **Step 1: Create shared Multer middleware**
  - Use `multer.memoryStorage()`.
  - Validate extension and MIME against jpeg/jpg/png/gif/webp.
  - Keep error callback typed without `any`.
  - Keep caller-controlled size limit.

- [ ] **Step 2: Replace generic disk upload**
  - Remove `path` and duplicated disk-storage configuration.
  - Upload `req.file.buffer` to `walai-booking/catalog`.
  - Return Cloudinary secure URL under the existing `data.url`.
  - On provider failure return status `503` with `{ error: 'Image upload is temporarily unavailable', code: 'UPLOAD_FAILED' }`.

- [ ] **Step 3: Typecheck**
  - Command: `npx tsc --noEmit`

---

### Task 3: Payment slips

**Files:**
- Modify: `backend/src/routes/payment.routes.ts`
- Modify: `backend/src/controllers/payment.controller.ts`

**Interfaces:**
- Consumes: `createImageUpload(5 * 1024 * 1024)`
- Consumes: `uploadImage` and `deleteCloudinaryImage`
- Preserves: `POST /api/payments/:id/slip`, multipart field `slip`, response `data.slip_image`

- [ ] **Step 1: Replace payment disk middleware**
  - Remove local destination/filename generation.
  - Keep image validation and 5 MB limit through shared middleware.

- [ ] **Step 2: Upload only after booking validation**
  - Validate member ownership, booking type, and allowed status before calling Cloudinary.
  - Use folder `walai-booking/slips`.
  - Use deterministic public ID `${bookingType}-${bookingId}`.
  - Store returned secure URL in `payment_slip`.

- [ ] **Step 3: Handle partial failure**
  - If DB update fails after Cloudinary succeeds, delete the new asset best-effort before returning.
  - Preserve existing staff notification behavior.
  - Return generic `UPLOAD_FAILED` for Cloudinary errors and retain existing booking validation responses.

- [ ] **Step 4: Typecheck**
  - Command: `npx tsc --noEmit`

---

### Task 4: Member avatars

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/controllers/auth.controller.ts`

**Interfaces:**
- Consumes: `createImageUpload(5 * 1024 * 1024)`
- Consumes: `uploadImage` and `deleteCloudinaryImage`
- Preserves: `POST /api/auth/profile/avatar`, multipart field `avatar`, returned `data.avatar`

- [ ] **Step 1: Replace avatar disk middleware**
  - Remove local destination/filename generation.
  - Retain 5 MB limit and image validation through shared middleware.

- [ ] **Step 2: Upload deterministic avatar**
  - Verify customer role and member existence before uploading.
  - Read previous `image_profile`.
  - Upload to `walai-booking/avatars` with public ID `member-${memberId}`.
  - Store secure URL in `members.image_profile`.

- [ ] **Step 3: Clean up safely**
  - If DB update fails, delete newly uploaded asset best-effort.
  - After DB success, delete previous Cloudinary asset only when its public ID differs.
  - Never delete Google `avatar_url` or legacy `/uploads` values.

- [ ] **Step 4: Typecheck**
  - Command: `npx tsc --noEmit`

---

### Task 5: Catalog image cleanup

**Files:**
- Modify: `backend/src/controllers/room.controller.ts`
- Modify: `backend/src/controllers/kayak.controller.ts`

**Interfaces:**
- Consumes: `deleteCloudinaryImage`
- Room update compares old `room_image` and `room_images.image_path` values with submitted values.
- Kayak deletion returns `image_path` from SQL before cleanup.

- [ ] **Step 1: Add room replacement cleanup**
  - Query current main and gallery image paths before update.
  - Complete DB update first.
  - Compute removed Cloudinary URLs by set difference.
  - Delete removed assets using `Promise.allSettled` so cleanup failure does not corrupt successful room data.

- [ ] **Step 2: Add kayak deletion cleanup**
  - Change `DELETE ... RETURNING` to include `image_path`.
  - Delete returned Cloudinary asset after DB deletion succeeds.
  - Log cleanup failure without exposing it to client.

- [ ] **Step 3: Verify legacy safety**
  - Confirm cleanup helper ignores `/uploads/...`, Google URLs, and unrelated external URLs.

- [ ] **Step 4: Run backend tests and build**
  - Commands:
    - `node --test -r ts-node/register src/services/cloudinary.service.test.ts`
    - `npm run build`

---

### Task 6: Configuration, end-to-end verification, and deployment handoff

**Files:**
- Modify: `README.md`
- Verify unchanged: `frontend/src/lib/avatar.ts`

**Interfaces:**
- Required Render env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- No frontend env change.

- [ ] **Step 1: Document Cloudinary setup**
  - Add account setup and backend env examples.
  - Explain that credentials belong only in backend local/Render env.
  - Explain that broken legacy images need manual re-upload.

- [ ] **Step 2: Run full verification**
  - Backend: `npm run build`
  - Frontend: `npm run build`
  - IDE lint diagnostics on every changed TypeScript file.
  - `git diff --check`

- [ ] **Step 3: Manual integration checks**
  - Upload one payment slip and confirm DB/API returns `https://res.cloudinary.com/...`.
  - Upload one avatar and confirm navbar/dashboard refresh.
  - Upload room main/gallery and kayak gallery images.
  - Restart backend and confirm all four image categories remain accessible.
  - Verify invalid non-image and over-limit image rejection.

- [ ] **Step 4: Deployment handoff**
  - List exact Render environment keys without values.
  - Do not commit or push unless user explicitly requests it.
