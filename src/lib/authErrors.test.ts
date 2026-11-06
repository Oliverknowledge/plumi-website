import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeadSession, isOfflineError } from "./authErrors";

describe("which auth errors sign a student out in this browser", () => {
  it("an invalid, used or unknown refresh token is a dead session (what the founder's 400 was)", () => {
    assert.equal(isDeadSession({ name: "AuthApiError", status: 400, code: "refresh_token_not_found", message: "Invalid Refresh Token: Refresh Token Not Found" }), true);
    assert.equal(isDeadSession({ name: "AuthApiError", status: 400, message: "Invalid Refresh Token: Already Used" }), true, "older servers send no code");
    assert.equal(isDeadSession({ name: "AuthApiError", status: 400, code: "refresh_token_already_used", message: "x" }), true);
    assert.equal(isDeadSession({ name: "AuthApiError", status: 401, code: "session_not_found", message: "x" }), true);
    assert.equal(isDeadSession({ name: "AuthSessionMissingError", status: 400, message: "Auth session missing!" }), true);
  });
  it("NEVER for a network or server error: a flaky connection signs nobody out", () => {
    assert.equal(isDeadSession({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" }), false);
    assert.equal(isDeadSession({ name: "AuthRetryableFetchError", status: 502, message: "Invalid Refresh Token" }), false);
    assert.equal(isDeadSession({ name: "AuthApiError", status: 503, message: "refresh token" }), false);
    assert.equal(isDeadSession({ name: "AuthApiError", status: 429, message: "refresh token rate limit" }), false);
    assert.equal(isDeadSession({ message: "refresh token" }), false, "no status at all");
    assert.equal(isDeadSession(null), false);
  });
  it("an unrelated refusal is not a dead session", () => {
    assert.equal(isDeadSession({ name: "AuthApiError", status: 400, message: "Something else is wrong" }), false);
    assert.equal(isDeadSession({ name: "AuthApiError", status: 422, message: "refresh token" }), false);
  });
  it("offline means no status, 0, 429 or 5xx, or the retryable class", () => {
    for (const e of [{ name: "AuthRetryableFetchError" }, { status: 0 }, { status: 429 }, { status: 500 }, {}]) assert.equal(isOfflineError(e), true);
    for (const e of [{ status: 400 }, { status: 401 }, null]) assert.equal(isOfflineError(e), false);
  });
});
