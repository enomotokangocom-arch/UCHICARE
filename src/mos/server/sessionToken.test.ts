import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./sessionToken";

const secret = "test-session-secret-0123456789";

describe("セッショントークン", () => {
  it("署名したトークンを検証できる", async () => {
    const t = await signSession({ userId: "u1", role: "STAFF" }, secret);
    expect(await verifySession(t, secret)).toEqual({ userId: "u1", role: "STAFF" });
  });
  it("改ざん・別の鍵・期限切れ・未設定は無効", async () => {
    const t = await signSession({ userId: "u1", role: "ADMIN" }, secret);
    expect(await verifySession(t.slice(0, -2) + "xx", secret)).toBeNull();
    expect(await verifySession(t, "another-secret-0123456789")).toBeNull();
    const old = await signSession({ userId: "u1", role: "ADMIN" }, secret, new Date(Date.now() - 9 * 3600 * 1000));
    expect(await verifySession(old, secret)).toBeNull();
    expect(await verifySession(undefined, secret)).toBeNull();
  });
});
