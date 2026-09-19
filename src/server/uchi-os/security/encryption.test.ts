import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "./encryption";

describe("encryptSecret / decryptSecret", () => {
  it("暗号化した値を復号すると元の文字列に戻る", () => {
    const plainText = "sk-live-example-token-12345";
    const encrypted = encryptSecret(plainText);
    expect(decryptSecret(encrypted)).toBe(plainText);
  });

  it("暗号文は平文をそのまま含まない", () => {
    const plainText = "super-secret-api-key";
    const encrypted = encryptSecret(plainText);
    expect(encrypted.toString("utf8")).not.toContain(plainText);
  });

  it("呼び出すたびにIVが異なるため暗号文が毎回変わる", () => {
    const plainText = "same-input";
    const a = encryptSecret(plainText);
    const b = encryptSecret(plainText);
    expect(a.equals(b)).toBe(false);
    expect(decryptSecret(a)).toBe(plainText);
    expect(decryptSecret(b)).toBe(plainText);
  });

  it("空文字列も往復できる", () => {
    const encrypted = encryptSecret("");
    expect(decryptSecret(encrypted)).toBe("");
  });
});
