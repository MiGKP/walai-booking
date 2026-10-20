# Simplify room guest selection

The user delegated the UX decision after approving a search-first flow. Customers choose dates and physical rooms before confirming guests once on booking details. No database, price, payment or age-policy changes. Do not commit or deploy until requested.

## Design

- Search: room type and dates; remove the guest picker. Existing guest query parameters remain supported for old links.
- Standard room detail (capacity 1–2): show capacity and explain that guest details are confirmed next; no guest entry required to select a room.
- Large room detail (capacity >= 4, determined by data): keep the optional detailed guest picker for group planning. Capacity 3 and legacy requests with children or more than two adults retain the picker for compatibility.
- Booking details: one editable guest section. For one standard room, use one/two-adult choices, otherwise use a count stepper. Children are optional; every child's actual age is required. Preserve age 0, children sharing existing beds, per-child optional extra beds and payment at the counter.
- Keep total occupancy validation on both frontend and backend. Record actual reviewed counts rather than inferring guests from room capacity.
- Persist valid guest edits to the existing cart and URL. Reset child bed selections when child identities/ages change so requests cannot attach to removed children.

## Implementation

1. Add guest selection component with accessible labels, radio/stepper controls and child-age selects; test count changes, unknown age, age zero and room-capacity variants.
2. Remove the search-page guest UI and obsolete handlers. Preserve availability/date behavior and old URL support.
3. Replace the standard-room detail picker with capacity text; retain detailed group controls for larger rooms/legacy selections.
4. Connect editable booking guests to the summary, occupancy, extra-bed choices, cart and request payload. Validate incomplete ages before submit.
5. Run frontend regression suite/build and targeted lint. Verify browser search, standard and large guest controls, child age and return navigation. Build backend if touched.

Reference: Agoda Partner Hub room occupancy/children/extra-bed policies support retaining accurate counts and ages. The proposed reduction in search inputs is specific to Walai's standard-room flow, not a claim that Agoda omits guest selection.
