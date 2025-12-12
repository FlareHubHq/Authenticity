#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
CIRCUIT_DIR="$PROJECT_DIR/circuits"

echo "=== FlareHub Authenticity Circuit Compilation ==="

mkdir -p "$BUILD_DIR"

if ! command -v circom &> /dev/null; then
    echo "Error: circom is not installed. Install with: cargo install circom"
    exit 1
fi

if ! command -v snarkjs &> /dev/null; then
    echo "Error: snarkjs is not installed. Install with: bun add -g snarkjs"
    exit 1
fi

echo "1. Compiling circuit..."
circom "$CIRCUIT_DIR/authenticity.circom" \
    --r1cs \
    --wasm \
    --sym \
    -o "$BUILD_DIR" \
    -l "$PROJECT_DIR/node_modules"

echo "2. Downloading powers of tau (if not exists)..."
PTAU_FILE="$BUILD_DIR/pot14_final.ptau"
if [ ! -f "$PTAU_FILE" ]; then
    echo "   Downloading powersOfTau28_hez_final_14.ptau..."
    curl -L -o "$PTAU_FILE" \
        "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
fi

echo "3. Generating zkey..."
snarkjs groth16 setup \
    "$BUILD_DIR/authenticity.r1cs" \
    "$PTAU_FILE" \
    "$BUILD_DIR/authenticity_0000.zkey"

echo "4. Contributing to ceremony..."
echo "flarehub-authenticity-poc" | snarkjs zkey contribute \
    "$BUILD_DIR/authenticity_0000.zkey" \
    "$BUILD_DIR/authenticity_final.zkey" \
    --name="FlareHub Contribution"

echo "5. Exporting verification key..."
snarkjs zkey export verificationkey \
    "$BUILD_DIR/authenticity_final.zkey" \
    "$BUILD_DIR/verification_key.json"

echo "6. Generating Solidity verifier..."
snarkjs zkey export solidityverifier \
    "$BUILD_DIR/authenticity_final.zkey" \
    "$BUILD_DIR/AuthenticityVerifier.sol"

echo ""
echo "=== Compilation Complete ==="
echo "Artifacts:"
echo "  - $BUILD_DIR/authenticity.r1cs"
echo "  - $BUILD_DIR/authenticity_js/authenticity.wasm"
echo "  - $BUILD_DIR/authenticity_final.zkey"
echo "  - $BUILD_DIR/verification_key.json"
echo "  - $BUILD_DIR/AuthenticityVerifier.sol"
