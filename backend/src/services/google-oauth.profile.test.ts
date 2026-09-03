import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractGoogleAvatar,
  extractGoogleEmail,
  extractGoogleName,
} from "./google-oauth.profile";

describe("extractGoogleEmail", () => {
  it("returns null when profile has no email fields", () => {
    assert.equal(extractGoogleEmail({ id: "1" }), null);
  });

  it("reads workspace email from _json when emails array is missing", () => {
    assert.equal(
      extractGoogleEmail({
        id: "1",
        _json: { email: "66011212078@MSU.ac.th" },
      }),
      "66011212078@msu.ac.th",
    );
  });

  it("prefers verified emails[] over unverified and json fallback", () => {
    assert.equal(
      extractGoogleEmail({
        id: "1",
        emails: [
          { value: "other@example.com", verified: false },
          { value: "real@example.com", verified: true },
        ],
        _json: { email: "json@example.com" },
      }),
      "real@example.com",
    );
  });
});

describe("extractGoogleName", () => {
  it("uses given and family name from profile", () => {
    assert.deepEqual(
      extractGoogleName(
        { name: { givenName: "Somchai", familyName: "Jaidee" } },
        "a@msu.ac.th",
      ),
      { firstName: "Somchai", lastName: "Jaidee" },
    );
  });

  it("falls back to local part of email when name missing", () => {
    assert.deepEqual(extractGoogleName({}, "66011212078@msu.ac.th"), {
      firstName: "66011212078",
      lastName: "",
    });
  });
});

describe("extractGoogleAvatar", () => {
  it("returns null when no photo", () => {
    assert.equal(extractGoogleAvatar({}), null);
  });
});
