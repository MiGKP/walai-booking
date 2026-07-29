# Login Three.js Experience Design

## Goal

Redesign `/auth/login` into a responsive split-screen sign-in experience whose interactive 3D scene communicates Walai Booking's floating accommodation and kayak activities without changing authentication behavior.

## Visual Direction

The screen uses the existing Isan Organic Oasis palette:

- Deep forest green for the form action and architectural accents
- Lagoon teal for water and ambient light
- Bamboo gold for the kayak, deck, and warm lantern
- Cream and stone for readable form surfaces

Desktop uses a 56/44 composition. The left side is an atmospheric Three.js scene; the right side is a quiet, editorial login form. Mobile stacks a compact scene above the form so authentication remains the primary task.

The 3D scene is procedural and original. It contains:

- A small floating bungalow with a dark green roof and warm window light
- A bamboo-colored kayak with a paddle
- A reflective lagoon plane and expanding water rings
- A deck, posts, reeds, stones, and low-poly landscape accents
- Soft fog, hemisphere lighting, directional light, and a lantern point light

Supporting Thai copy: “กลับมาพักใจกลางสายน้ำ” with a short line explaining room and kayak booking.

## Interaction and Motion

- The scene rotates slowly on its own.
- Pointer movement gently tilts the scene; touch movement uses the same normalized input.
- The bungalow and kayak bob at different amplitudes to feel waterborne.
- Water rings expand and fade continuously.
- Camera movement is constrained; users cannot zoom or drag the model away.
- Rendering pauses when the tab is hidden.
- `prefers-reduced-motion: reduce` disables auto-rotation, pointer tilt, bobbing, and ring animation while preserving the complete static scene.

## Performance

- Use vanilla `three`, dynamically imported inside the client component so it is excluded from server rendering.
- Cap renderer pixel ratio at 1.5 on desktop and 1.25 on narrow screens.
- Use simple primitive geometry and shared materials; do not load GLB models, textures, HDR files, or remote assets.
- Keep draw calls low and dispose every geometry, material, renderer, listener, and animation frame on unmount.
- Resize through `ResizeObserver` instead of rendering at window dimensions.

## Responsive Behavior

- Desktop (`lg` and above): scene on the left, form on the right, full viewport height.
- Tablet: balanced two-column layout with reduced scene detail scale.
- Mobile: scene height around 230–260px, form beneath it, no horizontal overflow, large touch targets.
- Login remains usable if WebGL initialization fails; the scene panel retains its CSS lagoon background and text while the form works normally.

## Form and Authentication

Preserve:

- `useAuthGuard({ guestOnly: true })`
- Email/password POST to `/auth/login`
- Role-aware `redirectUrl`
- Google OAuth redirect
- Forgot-password and registration links
- Existing toast success/error behavior

Improve:

- Explicit return types
- `unknown` error narrowing instead of `any`
- Accessible labels and `aria-label` for password visibility
- Back-to-home link
- Clear focus states and loading/disabled feedback

## Component Boundary

Create `frontend/src/components/auth/LoginScene3D.tsx` as the only Three.js owner. It receives no authentication state and emits no business events. The login page owns form state and places the scene alongside the form.

Scene-specific CSS classes and keyframes live in `frontend/src/app/globals.css`; general button and input primitives remain unchanged.

## Verification

- `npm run build` completes.
- IDE lint diagnostics show no new errors.
- Browser verification at desktop and mobile widths confirms layout, animation, pointer response, and no console errors.
- Reduced-motion emulation produces a static scene.
- Login, Google OAuth link, forgot password, and register navigation remain functional.
- WebGL failure does not hide or disable the form.
