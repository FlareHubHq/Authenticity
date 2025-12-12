import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import {
  generateProof,
  verifyProofLocally,
  addressToFieldElement,
  generateRandomFieldElement,
  hashToFieldElement,
} from "../ts/proof-generator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUILD_DIR = join(__dirname, "..", "build");
const WASM_PATH = join(BUILD_DIR, "authenticity_js", "authenticity.wasm");
const ZKEY_PATH = join(BUILD_DIR, "authenticity_final.zkey");
const VKEY_PATH = join(BUILD_DIR, "verification_key.json");
const OUTPUT_DIR = join(__dirname, "..", "output");

async function main() {
  console.log("=== FlareHub Authenticity Proof Generator ===\n");

  if (!existsSync(WASM_PATH)) {
    console.error("Error: Circuit not compiled. Run: ./scripts/compile-circuit.sh");
    process.exit(1);
  }

  const walletAddress = process.argv[2] || "0x1234567890123456789012345678901234567890";
  const identifierData = process.argv[3] || "user-biometric-hash-example";

  console.log("Input:");
  console.log("  Wallet:", walletAddress);
  console.log("  Identifier data:", identifierData);
  console.log("");

  const inputs = {
    walletAddress: addressToFieldElement(walletAddress),
    uniqueIdentifier: hashToFieldElement(identifierData),
    salt: generateRandomFieldElement(),
    nullifierSecret: generateRandomFieldElement(),
  };

  console.log("Generating proof...");
  const startTime = Date.now();

  const result = await generateProof(inputs, WASM_PATH, ZKEY_PATH);

  const duration = Date.now() - startTime;
  console.log(`Proof generated in ${duration}ms\n`);

  console.log("Verifying proof locally...");
  const isValid = await verifyProofLocally(result.proof, result.publicSignals, VKEY_PATH);
  console.log("Local verification:", isValid ? "VALID ✓" : "INVALID ✗");

  if (!isValid) {
    console.error("Proof verification failed!");
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const output = {
    proof: result.proof,
    publicSignals: result.publicSignals,
    commitment: result.commitment,
    nullifier: result.nullifier,
    wallet: walletAddress,
    generatedAt: new Date().toISOString(),
  };

  const outputPath = join(OUTPUT_DIR, `proof_${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nProof saved to: ${outputPath}`);

  console.log("\n=== Proof Details ===");
  console.log("Commitment:", result.commitment.slice(0, 30) + "...");
  console.log("Nullifier:", result.nullifier.slice(0, 30) + "...");
  console.log("Public signals:", result.publicSignals.length);
}

main().catch(console.error);
