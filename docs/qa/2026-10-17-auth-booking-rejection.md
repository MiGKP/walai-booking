# Password policy, booking mail, and pre-check-in rejection

## Behavior

- New passwords require at least eight Unicode code points and at most 72 UTF-8 bytes. Reject common passwords, repeated characters, whitespace-only values, and non-string input. Preserve password whitespace rather than silently trimming it before hashing. Login continues accepting existing credentials without the new-password policy.
- Registration, recovery, customer profile, and staff/admin profile use the same new-password rules. Backend also checks staff creation and initial admin setup.
- The initial booking email explicitly acknowledges a request and does not confirm payment or approval. Customer approval/rejection emails are triggered after commit through one shared helper, including the payment confirmation endpoint. Rejection mail escapes and includes the reason, links to the dashboard booking tab, and does not offer resubmission to a terminal rejected booking.
- Room check-in can reject the entire booking only before any physical room has checked in or out. The confirmation explicitly explains that all rooms are affected. Existing backend locks and started-room guards remain authoritative.
- Boat check-in can reject waiting reservations. Checked-in, returned, or handed-out addon reservations remain protected. Rejecting an addon saves `rejected` and the staff reason while retaining the existing refund policy, room-total adjustment, and ticket restoration transaction. Customer cancellation remains `cancelled`.
- Both staff check-in routes reuse the updated admin pages. Customer booking cards already display rejected status and show its reason in expanded details.
- Password fields with an application visibility toggle hide Edge's native reveal button. Native-only fields retain their browser button.

## Verification

- Backend build and regression suite: 170 passed, no skips.
- Frontend build and regression suite: 86 passed, no skips.
- Added coverage for password boundaries and compatibility, mandatory bounded rejection reasons, normal and addon status changes, post-commit notifications, escaped email content, early/late/free/unpaid addon refund cases, started-service guards, customer cards, and check-in actions.
- Headless Edge against the local production frontend: room rejection and refresh, boat rejection on a phone viewport, required reason, checked-in room/boat protection, and weak/long password submission. API responses were intercepted with synthetic fixtures; no production booking or account was created.
- Screenshots and browser receipts are outside the repository in the Downloads audit folder.
- Headless Edge verified visibility toggles on login, registration, reset, customer security (existing and Google accounts), and native-only admin profile fields. Before/after screenshots confirm one eye; reveal/hide preserves the password value.

## Live email verification and remaining limits

After the user configured the Brevo API key and authorized the local sending IP, the live API accepted all six test messages with HTTP 201 and distinct message IDs: request received, approved, and rejected for both room and boat bookings. Messages used the test subject prefix and synthetic details; no booking, account, payment, or database row was created. Provider receipts are saved outside the repository in the Downloads audit folder.

API acceptance does not prove inbox placement or the configuration on the production backend host. Recipient confirmation and production-host delivery remain separate checks. The user was advised to replace credentials exposed in a screenshot. Tests did not apply database migrations or change production booking records.
