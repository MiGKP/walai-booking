# Room date selection and amenity deletion QA

## Changes

- Customers and staff can select today (Asia/Bangkok) for room check-in. Past days remain disabled. The existing booking API rechecks actual room availability inside its transaction.
- Room dates start empty unless supplied explicitly in the URL. First click records only check-in; check-out remains empty until clicked. No hover/focus-generated checkout. Clearing dates removes both URL parameters.
- Room listing, detail and cart calendars use the same two-step date selection. Search/room selection/checkout cannot proceed with an incomplete stay. A partial new selection cannot borrow checkout from an old cart.
- The room-detail calendar remains mounted while selecting checkout. Cancelled availability requests cannot overwrite a newer response. Room badges ask for dates before claiming availability.
- Referenced amenities return HTTP 409 on deletion, including references from inactive room types. No room amenity arrays are silently modified. Unused amenities remain deletable.
- Room-type writes validate and share-lock referenced amenities; deletion locks the amenity before checking usage. Admin UI displays usage counts and disables deletion with an explanation. The API remains authoritative for stale browser data.

## Verification

- Backend build and regression tests: 199 passed.
- Frontend build and regression tests: 102 passed.
- New calendar/controller tests reproduced the old failures before implementation.
- Browser checked at `http://127.0.0.1:3012/rooms` as a signed-out visitor: today selectable, yesterday disabled, first click produced `?check_in=2026-10-19` with one selected day and disabled confirmation; second click produced `check_out=2026-10-21` and displayed 2 nights; clear removed both dates and showed empty steps again.
- The configured local API was unavailable during browser verification, so room data and real booking submissions were not verified through that browser. Stock, date rejection, deletion protection and request payload behavior were verified with isolated regression tests. No production booking, amenity, email, or media changes were made during QA.
- No database migration or dependency change is required. Production deployment is authorized separately after validation.
