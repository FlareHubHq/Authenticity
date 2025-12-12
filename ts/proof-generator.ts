import * as snarkjs from "snarkjs";
import { poseidon2, poseidon3 } from "poseidon-lite";
import { readFileSync } from "fs";

export interface ProofInputs {
  walletAddress: bigint;
  uniqueIdentifier: bigint;
  salt: bigint;
  nullifierSecret: bigint;
}

export interface GeneratedProof {
  proof: snarkjs.Groth16Proof;
  publicSignals: string[];
  commitment: string;
  nullifier: string;
}

export function computeCommitment(
  walletAddress: bigint,
  uniqueIdentifier: bigint,
  salt: bigint
): bigint {
  return poseidon3([walletAddress, uniqueIdentifier, salt]);
}

export function computeNullifier(
  nullifierSecret: bigint,
  uniqueIdentifier: bigint
): bigint {
  return poseidon2([nullifierSecret, uniqueIdentifier]);
}

export function addressToFieldElement(address: string): bigint {
  const cleaned = address.toLowerCase().replace("0x", "");
  return BigInt("0x" + cleaned);
}

export function generateRandomFieldElement(): bigint {
  const bytes = new Uint8Array(31);
  crypto.getRandomValues(bytes);
  let hex = "0x";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return BigInt(hex);
}

export async function generateProof(
  inputs: ProofInputs,
  wasmPath: string,
  zkeyPath: string
): Promise<GeneratedProof> {
  const commitment = computeCommitment(
    inputs.walletAddress,
    inputs.uniqueIdentifier,
    inputs.salt
  );

  const nullifier = computeNullifier(
    inputs.nullifierSecret,
    inputs.uniqueIdentifier
  );

  const circuitInputs = {
    walletAddress: inputs.walletAddress.toString(),
    uniqueIdentifier: inputs.uniqueIdentifier.toString(),
    salt: inputs.salt.toString(),
    nullifierSecret: inputs.nullifierSecret.toString(),
    commitment: commitment.toString(),
    nullifier: nullifier.toString(),
  };

  console.log("[ProofGen] Generating proof with inputs:", {
    walletAddress: inputs.walletAddress.toString().slice(0, 20) + "...",
    commitment: commitment.toString().slice(0, 20) + "...",
    nullifier: nullifier.toString().slice(0, 20) + "...",
  });

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    wasmPath,
    zkeyPath
  );

  return {
    proof,
    publicSignals,
    commitment: commitment.toString(),
    nullifier: nullifier.toString(),
  };
}

export async function verifyProofLocally(
  proof: snarkjs.Groth16Proof,
  publicSignals: string[],
  vkeyPath: string
): Promise<boolean> {
  const vkey = JSON.parse(readFileSync(vkeyPath, "utf-8"));
  return await snarkjs.groth16.verify(vkey, publicSignals, proof);
}

export function prepareProofForContract(proof: snarkjs.Groth16Proof): {
  a: [string, string];
  b: [[string, string], [string, string]];
  c: [string, string];
} {
  const b0 = proof.pi_b[0] ?? ["", ""];
  const b1 = proof.pi_b[1] ?? ["", ""];
  return {
    a: [proof.pi_a[0] ?? "", proof.pi_a[1] ?? ""],
    b: [
      [b0[1] ?? "", b0[0] ?? ""],
      [b1[1] ?? "", b1[0] ?? ""],
    ],
    c: [proof.pi_c[0] ?? "", proof.pi_c[1] ?? ""],
  };
}

export function hashToFieldElement(data: string): bigint {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  let hash = 0n;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash * 256n + BigInt(bytes[i]!)) % (2n ** 253n);
  }
  return hash;
}
