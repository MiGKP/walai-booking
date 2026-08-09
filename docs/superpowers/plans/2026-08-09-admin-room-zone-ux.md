# Admin Room Zone UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When admin opens `/admin/rooms/single?type_id=N` from the types list, auto-select that type, filter the table, and show zone prefix + next room number clearly.

**Architecture:** Frontend-only. Reuse `GET /rooms/single/next-number`. No schema changes.

**Spec:** `docs/superpowers/specs/2026-08-09-admin-room-zone-ux-design.md`

### Task 1: Wire `type_id` + zone chip on single page

**Files:**
- Modify: `frontend/src/app/admin/rooms/single/page.tsx`

- [x] `useSearchParams` for `type_id`
- [x] After rooms/types load, if id valid: select type, call next-number, set `typeFilter`
- [x] Show Thai chip: `โซน {prefix} · เลขถัดไป {prefix}{next}` when creating (not editing)
- [x] `npm run build` in `frontend/`

### Execution

Inline in this session.
