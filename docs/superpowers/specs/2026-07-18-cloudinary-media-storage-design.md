# Cloudinary Media Storage Design

## Problem

Render Free uses an ephemeral filesystem. Images written to `backend/uploads/` disappear whenever the service restarts, redeploys, or spins down, while PostgreSQL still retains `/uploads/...` paths. The result is a valid booking or profile record whose image URL returns `404`.

## Scope

Move every new user-managed image to Cloudinary:

- Room and kayak payment slips
- Member profile avatars
- Room type main and gallery images
- Kayak gallery images

Google profile images remain external URLs. Reviews do not have their own upload flow and need no upload change.

## Architecture

The frontend continues sending multipart form data to the existing API endpoints. Backend Multer middleware changes from disk storage to memory storage, preserving current field names, size limits, MIME validation, authentication, and response shapes.

A shared Cloudinary service:

- Configures the SDK from `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`
- Uploads image buffers through `upload_stream`
- Returns Cloudinary `secure_url`
- Deletes replaced or removed Cloudinary assets on a best-effort basis
- Ignores non-Cloudinary URLs during cleanup for backward compatibility

Cloudinary folders:

- `walai-booking/slips`
- `walai-booking/avatars`
- `walai-booking/catalog`

Slips and avatars use deterministic public IDs based on booking/member IDs so replacement overwrites the old asset. Catalog images use unique IDs because multiple gallery images can belong to one room or kayak.

## Data Flow

### Payment slip

1. Authenticate member and validate image in memory.
2. Validate booking ownership and status.
3. Upload buffer to `walai-booking/slips`.
4. Store returned HTTPS URL in `room_bookings.payment_slip` or `boat_bookings.payment_slip`.
5. Return the existing response shape and send staff notification.

### Avatar

1. Authenticate member and validate image in memory.
2. Upload buffer to `walai-booking/avatars`.
3. Update `members.image_profile` with the HTTPS URL.
4. Overwrite the deterministic member asset; clean a previous differing Cloudinary URL after successful DB update.

### Room and kayak catalog images

1. Admin uploads through the existing `/api/uploads/image` endpoint.
2. Backend uploads to `walai-booking/catalog`.
3. Endpoint returns the existing `{ data: { url } }` shape.
4. Existing room/kayak APIs persist the full URL without frontend changes.
5. Removing a persisted gallery image triggers best-effort Cloudinary cleanup.

## Backward Compatibility

`frontend/src/lib/avatar.ts` already passes full `http://` and `https://` URLs through unchanged and prefixes legacy `/uploads/...` values with the API origin. No frontend URL-resolution change is required.

The Express `/uploads` static route remains temporarily so any surviving local development files still work. Render files already lost cannot be recovered; affected room images, avatars, and slips must be uploaded again.

No database schema migration is required because existing image columns already store strings.

## Error Handling

- Missing Cloudinary configuration fails the upload request with a clear server-side error.
- Invalid file type and oversize files remain rejected by Multer.
- Cloudinary upload failures return a generic `UPLOAD_FAILED` API error without credentials or stack traces.
- If a DB write fails after upload, the newly uploaded asset is deleted best-effort.
- Cleanup failure does not roll back a successful DB update; it is logged for later review.

## Security

- Cloudinary credentials remain backend-only.
- Upload endpoints retain current authentication and authorization.
- Only recognized image MIME types and extensions are accepted.
- File size remains 5 MB for slips/avatars and 10 MB for catalog images.
- Cloudinary URLs use HTTPS.

## Verification

- Backend TypeScript build succeeds.
- Frontend build succeeds without endpoint contract changes.
- Local integration checks cover slip, avatar, room image, and kayak image uploads.
- Returned URLs begin with `https://res.cloudinary.com/`.
- Uploaded images remain accessible after a backend restart.
- Invalid and oversize files are rejected.
- Legacy full URLs and `/uploads/...` paths still resolve as before.
