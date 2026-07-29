# Login Three.js Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive login screen with a procedural, pointer-reactive Three.js floating bungalow and kayak scene while preserving all existing authentication flows.

**Architecture:** A dedicated client component dynamically imports Three.js, owns the complete WebGL lifecycle, and renders into an isolated mount element. The login page remains responsible for auth state and composes the scene with a redesigned form. Small scene-only styles live in global CSS; no remote 3D assets or textures are introduced.

**Tech Stack:** Next.js 16, React 19, TypeScript strict mode, Tailwind CSS, Three.js, React Hot Toast.

## Global Constraints

- Preserve email/password login, Google OAuth, role redirect, forgot-password, and register behavior.
- Use vanilla Three.js, not React Three Fiber, Spline, iframe embeds, GLB assets, remote textures, or shader dependencies.
- All changed TypeScript functions have explicit return types and use `unknown` rather than `any`.
- Respect `prefers-reduced-motion` and keep login usable without WebGL.
- Cap device pixel ratio and dispose all WebGL resources on unmount.
- Do not commit or push unless the user explicitly requests it.

---

### Task 1: Add Three.js dependency and scene component shell

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/components/auth/LoginScene3D.tsx`

**Interfaces:**
- Produces: `LoginScene3D(): React.ReactElement`
- Owns: Three.js renderer, scene, camera, frame loop, listeners, and cleanup
- Exposes: no props and no auth state

- [ ] **Step 1: Install current supported packages**
  - Run in `frontend/`: `npm install three`
  - Run in `frontend/`: `npm install -D @types/three`
  - Let npm select versions; do not invent version numbers.

- [ ] **Step 2: Create client component lifecycle**
  - Add `'use client'`.
  - Create `mountRef` and `useEffect`.
  - Inside the effect, dynamically import `three`.
  - Abort initialization if the effect was cleaned up before import resolves.
  - Create a transparent antialiased `WebGLRenderer`.
  - Set sRGB color space, ACES filmic tone mapping, soft shadows, and pixel ratio capped at `1.25` under 768px or `1.5` otherwise.
  - Append exactly one canvas to `mountRef`.
  - Display a static CSS-backed panel if renderer creation throws.

- [ ] **Step 3: Add resize and cleanup**
  - Use `ResizeObserver` to update camera aspect and renderer size from the mount element.
  - Cancel `requestAnimationFrame`.
  - Remove pointer, visibility, media-query, and resize observers.
  - Traverse the scene and dispose geometries and single/array materials.
  - Call `renderer.dispose()` and remove its canvas.

- [ ] **Step 4: Verify component shell**
  - Let TypeScript compile the new component through the existing `src/**/*` project include; do not add temporary UI wiring.
  - Run `npm run build`.
  - Expected: successful compilation with no server-side `window` or WebGL access.

---

### Task 2: Build the procedural floating-resort scene

**Files:**
- Modify: `frontend/src/components/auth/LoginScene3D.tsx`

**Scene graph:**
- `worldGroup`: rotates and tilts from auto motion/pointer input
- `bungalowGroup`: platform, house, roof, windows, rails, posts, lantern
- `kayakGroup`: hull, inner seat, paddle shaft, paddle blades
- `environmentGroup`: lagoon, rings, reeds, stones, low-poly banks

- [ ] **Step 1: Configure camera and lighting**
  - Perspective camera: field of view around 38°, position near `(8, 6, 10)`, looking at `(0, 1, 0)`.
  - Fog and scene background use lagoon/cream-compatible colors.
  - Add hemisphere, directional, and warm point lights.
  - Enable shadows only on the main bungalow, platform, kayak, and water receiver.

- [ ] **Step 2: Build shared materials**
  - Forest roof/trim, cream walls, bamboo deck/kayak, dark charcoal details, warm emissive windows, translucent lagoon water.
  - Reuse material instances rather than creating one per mesh.

- [ ] **Step 3: Build bungalow**
  - Platform and deck from box geometries.
  - House body from a cream box.
  - Four-sided cone roof rotated to align with the bungalow.
  - Window planes with emissive warm material.
  - Thin rail/post cylinders and boxes.
  - Lantern mesh paired with the warm point light.

- [ ] **Step 4: Build kayak and environment**
  - Kayak hull from a scaled sphere geometry, dark inset seat, cylinder paddle, and flattened blade meshes.
  - Water from a large circle or plane with physical transparent material.
  - Three torus rings rotated onto the water plane.
  - Small reeds and stones grouped near the scene edge.
  - Keep total scene intentionally low-poly.

- [ ] **Step 5: Add motion**
  - Track normalized pointer coordinates from pointer movement over the mount only.
  - Lerp world rotation toward pointer targets.
  - Add slow auto-rotation when motion is allowed.
  - Bob bungalow and kayak with distinct sine frequencies.
  - Scale/fade water rings in staggered cycles.
  - Pause animation updates while `document.hidden`.
  - With reduced motion, render a single stable frame and only rerender on resize.

- [ ] **Step 6: Verify scene**
  - Run `npm run build`.
  - Open login locally and confirm one canvas, no console warnings, pointer response, and stable resize.

---

### Task 3: Redesign and harden the login page

**Files:**
- Modify: `frontend/src/app/auth/login/page.tsx`

**Interfaces:**
- Consumes: `LoginScene3D`
- Preserves: `/auth/login` request payload `{ email, password }`
- Preserves: `login(token)`, returned `redirectUrl`, Google OAuth URL, and all auth links

- [ ] **Step 1: Harden error handling**
  - Import `AxiosError` from `axios`.
  - Change submit handler to `async (event: React.FormEvent<HTMLFormElement>): Promise<void>`.
  - Catch `unknown`; use `AxiosError<{ message?: string }>` narrowing before reading response data.
  - Give `handleGoogleLogin` an explicit `void` return type.

- [ ] **Step 2: Build split layout**
  - Full-height cream/stone background with a constrained large panel.
  - Left visual section occupies about 56% on desktop and a compact top section on mobile.
  - Render `LoginScene3D` behind/alongside concise Thai scene copy.
  - Add back-to-home link with `ArrowLeft`.
  - Right form uses strong typographic hierarchy, calm spacing, and no nested card clutter.

- [ ] **Step 3: Preserve accessible form behavior**
  - Keep labels associated with email and password inputs through `htmlFor` and `id`.
  - Keep password visibility button with dynamic Thai `aria-label`.
  - Disable submit while loading and set `aria-busy`.
  - Keep Google button, separator, forgot-password link, and register link.
  - Use the existing Google mark SVG without adding remote scripts.

- [ ] **Step 4: Verify auth behavior**
  - Confirm empty required fields are blocked by browser validation.
  - Confirm password visibility toggles.
  - Confirm forgot-password, register, home, and Google links point to existing routes.
  - Confirm failed credentials still show backend message.

---

### Task 4: Scene styling, responsive polish, and release verification

**Files:**
- Modify: `frontend/src/app/globals.css`
- Verify: `frontend/src/components/layout/AppShell.tsx`

**Styles:**
- `.login-scene-shell`: isolated perspective/overflow container and lagoon fallback
- `.login-scene-canvas`: fills container and fades in after mount
- `.login-scene-glow`: non-interactive atmospheric radial light
- Mobile and reduced-motion media rules

- [ ] **Step 1: Add scene-only CSS**
  - Use project palette variables.
  - Add subtle grain/gradient through CSS only.
  - Ensure canvas never captures keyboard focus and does not block form interaction.
  - Set responsive minimum heights without causing horizontal overflow.

- [ ] **Step 2: Validate reduced motion and fallback**
  - Emulate `prefers-reduced-motion: reduce`; verify static scene.
  - Disable WebGL in browser tools or force renderer failure; verify copy and form remain visible.

- [ ] **Step 3: Run full checks**
  - Run `npm run build` in `frontend/`.
  - Read IDE lint diagnostics for login, scene component, and globals.
  - Run `git diff --check`.

- [ ] **Step 4: Browser verification**
  - Check approximately 1440×900, 1024×768, 768×1024, and 390×844.
  - Verify no clipping, no form overlap, one visible primary action, readable Thai text, and acceptable animation frame rate.
  - Verify console has no Three.js, hydration, accessibility, or CSP errors.

- [ ] **Step 5: Handoff**
  - Report bundle/build result and files changed.
  - Do not commit or push unless explicitly requested.
