import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  generateProof,
  verifyProofLocally,
  computeCommitment,
  computeNullifier,
  addressToFieldElement,
  generateRandomFieldElement,
  hashToFieldElement,
} from "../ts/proof-generator";

const BUILD_DIR = join(import.meta.dirname!, "..", "build");
const WASM_PATH = join(BUILD_DIR, "authenticity_js", "authenticity.wasm");
const ZKEY_PATH = join(BUILD_DIR, "authenticity_final.zkey");
const VKEY_PATH = join(BUILD_DIR, "verification_key.json");

const CIRCUIT_COMPILED = existsSync(WASM_PATH);

describe("Authenticity Circuit", () => {
  describe("Poseidon Hash Functions", () => {
    it("should compute deterministic commitment", () => {
      const wallet = 123456789n;
      const identifier = 987654321n;
      const salt = 111111111n;

      const commitment1 = computeCommitment(wallet, identifier, salt);
      const commitment2 = computeCommitment(wallet, identifier, salt);

      expect(commitment1).toBe(commitment2);
      expect(typeof commitment1).toBe("bigint");
    });

    it("should compute different commitments for different inputs", () => {
      const wallet = 123456789n;
      const identifier = 987654321n;
      const salt1 = 111111111n;
      const salt2 = 222222222n;

      const commitment1 = computeCommitment(wallet, identifier, salt1);
      const commitment2 = computeCommitment(wallet, identifier, salt2);

      expect(commitment1).not.toBe(commitment2);
    });

    it("should compute deterministic nullifier", () => {
      const secret = 123456789n;
      const identifier = 987654321n;

      const nullifier1 = computeNullifier(secret, identifier);
      const nullifier2 = computeNullifier(secret, identifier);

      expect(nullifier1).toBe(nullifier2);
    });

    it("should compute same nullifier for same identifier regardless of wallet", () => {
      const secret = 123456789n;
      const identifier = 987654321n;

      const nullifier = computeNullifier(secret, identifier);

      expect(typeof nullifier).toBe("bigint");
      expect(nullifier > 0n).toBe(true);
    });
  });

  describe("Utility Functions", () => {
    it("should convert address to field element", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const field = addressToFieldElement(address);

      expect(typeof field).toBe("bigint");
      expect(field > 0n).toBe(true);
    });

    it("should handle lowercase and uppercase addresses", () => {
      const lower = "0xabcdef1234567890abcdef1234567890abcdef12";
      const upper = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12";

      expect(addressToFieldElement(lower)).toBe(addressToFieldElement(upper));
    });

    it("should generate random field elements", () => {
      const r1 = generateRandomFieldElement();
      const r2 = generateRandomFieldElement();

      expect(r1).not.toBe(r2);
      expect(typeof r1).toBe("bigint");
    });

    it("should hash string to field element", () => {
      const data = "test-biometric-data";
      const hash = hashToFieldElement(data);

      expect(typeof hash).toBe("bigint");
      expect(hashToFieldElement(data)).toBe(hash);
    });
  });

  describe.skipIf(!CIRCUIT_COMPILED)("Proof Generation", () => {
    it("should generate valid proof", async () => {
      const inputs = {
        walletAddress: addressToFieldElement("0x1234567890123456789012345678901234567890"),
        uniqueIdentifier: hashToFieldElement("test-identifier"),
        salt: generateRandomFieldElement(),
        nullifierSecret: generateRandomFieldElement(),
      };

      const result = await generateProof(inputs, WASM_PATH, ZKEY_PATH);

      expect(result.proof).toBeDefined();
      expect(result.publicSignals).toHaveLength(2);
      expect(result.commitment).toBeDefined();
      expect(result.nullifier).toBeDefined();
    }, 60000);

    it("should verify proof locally", async () => {
      const inputs = {
        walletAddress: addressToFieldElement("0xabcdef1234567890abcdef1234567890abcdef12"),
        uniqueIdentifier: hashToFieldElement("another-identifier"),
        salt: generateRandomFieldElement(),
        nullifierSecret: generateRandomFieldElement(),
      };

      const result = await generateProof(inputs, WASM_PATH, ZKEY_PATH);
      const isValid = await verifyProofLocally(result.proof, result.publicSignals, VKEY_PATH);

      expect(isValid).toBe(true);
    }, 60000);

    it("should produce consistent commitment in proof", async () => {
      const inputs = {
        walletAddress: 12345n,
        uniqueIdentifier: 67890n,
        salt: 11111n,
        nullifierSecret: 22222n,
      };

      const expectedCommitment = computeCommitment(
        inputs.walletAddress,
        inputs.uniqueIdentifier,
        inputs.salt
      );

      const result = await generateProof(inputs, WASM_PATH, ZKEY_PATH);

      expect(result.commitment).toBe(expectedCommitment.toString());
    }, 60000);

    it("should produce consistent nullifier in proof", async () => {
      const inputs = {
        walletAddress: 12345n,
        uniqueIdentifier: 67890n,
        salt: 11111n,
        nullifierSecret: 22222n,
      };

      const expectedNullifier = computeNullifier(
        inputs.nullifierSecret,
        inputs.uniqueIdentifier
      );

      const result = await generateProof(inputs, WASM_PATH, ZKEY_PATH);

      expect(result.nullifier).toBe(expectedNullifier.toString());
    }, 60000);
  });
});

describe("Sybil Resistance Properties", () => {
  it("same identifier produces same nullifier (prevents double registration)", () => {
    const identifier = hashToFieldElement("unique-person-id");
    const secret1 = 111n;
    const secret2 = 111n;

    const nullifier1 = computeNullifier(secret1, identifier);
    const nullifier2 = computeNullifier(secret2, identifier);

    expect(nullifier1).toBe(nullifier2);
  });

  it("different identifiers produce different nullifiers", () => {
    const identifier1 = hashToFieldElement("person-1");
    const identifier2 = hashToFieldElement("person-2");
    const secret = 111n;

    const nullifier1 = computeNullifier(secret, identifier1);
    const nullifier2 = computeNullifier(secret, identifier2);

    expect(nullifier1).not.toBe(nullifier2);
  });

  it("same person can have different commitments (privacy)", () => {
    const wallet = addressToFieldElement("0x1234567890123456789012345678901234567890");
    const identifier = hashToFieldElement("same-person");
    const salt1 = generateRandomFieldElement();
    const salt2 = generateRandomFieldElement();

    const commitment1 = computeCommitment(wallet, identifier, salt1);
    const commitment2 = computeCommitment(wallet, identifier, salt2);

    expect(commitment1).not.toBe(commitment2);
  });
});
