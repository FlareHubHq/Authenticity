# FlareHub Authenticity POC

Zero-Knowledge proof-based authenticity verification for FlareHub using zkVerify.

## Overview

This POC implements Sybil-resistant identity verification using:
- **Circom** circuits for ZK proof generation
- **zkVerify** for decentralized proof verification
- **Foundry** for smart contract development
- **Bun** for TypeScript tooling

## Architecture

```
User → Generate Proof (client) → Submit to zkVerify → Verify on Flare Chain
         ↓                              ↓                    ↓
   commitment + nullifier        aggregation           on-chain registry
```

## Project Structure

```
poc/
├── circuits/           # Circom ZK circuits
│   └── authenticity.circom
├── src/                # Solidity contracts
│   └── FlareHubAuthenticityRegistry.sol
├── test/               # Tests (Foundry + Vitest)
│   ├── FlareHubAuthenticityRegistry.t.sol
│   └── circuit.test.ts
├── ts/                 # TypeScript library
│   ├── proof-generator.ts
│   └── zkverify.ts
├── scripts/            # Build & deployment scripts
│   ├── compile-circuit.sh
│   ├── generate-proof.ts
│   └── deploy.ts
└── lib/                # Foundry dependencies
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Bun](https://bun.sh/)
- [Circom](https://docs.circom.io/getting-started/installation/) (for circuit compilation)
- [snarkjs](https://github.com/iden3/snarkjs) (global install: `bun add -g snarkjs`)

## Setup

```bash
# Install dependencies
bun install

# Install Foundry dependencies
forge install
```

## Usage

### Build Contracts

```bash
forge build
# or
bun run build:sol
```

### Run Solidity Tests

```bash
forge test
# or
bun run test:sol
```

### Run TypeScript Tests

```bash
bun test
```

### Compile Circuit

```bash
./scripts/compile-circuit.sh
# or
bun run compile:circuit
```

This will:
1. Compile the Circom circuit
2. Download powers of tau
3. Generate zkey files
4. Export verification key

### Generate a Proof

```bash
bun run generate:proof <wallet_address> <identifier_data>
# Example:
bun run generate:proof 0x1234...5678 "user-biometric-hash"
```

### Deploy Contract

```bash
# Set environment variables first (see .env.example)
bun run deploy
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
SEED_PHRASE="your twelve word seed phrase for zkVerify"
ZKVERIFY_DOMAIN_ID=0
ZKVERIFY_CONTRACT_ADDRESS="0x..."
DEPLOYER_PRIVATE_KEY="0x..."
USE_TESTNET=true
```

## Key Components

### Circuit (`circuits/authenticity.circom`)

Proves knowledge of:
- Wallet address
- Unique identifier (biometric/document hash)
- Salt (for privacy)
- Nullifier secret

Outputs:
- **Commitment**: `poseidon(wallet, identifier, salt)` - binds identity to wallet
- **Nullifier**: `poseidon(secret, identifier)` - prevents double registration

### Contract (`src/FlareHubAuthenticityRegistry.sol`)

- Upgradeable (UUPS pattern)
- Integrates with zkVerify for proof verification
- Tracks nullifiers to prevent Sybil attacks
- Stores user commitments and verification timestamps

### TypeScript Library (`ts/`)

- `proof-generator.ts`: Client-side proof generation using snarkjs
- `zkverify.ts`: Service wrapper for zkVerifyJS SDK

## Testing

### Foundry Tests

14 tests covering:
- Initialization
- Proof verification flow
- Nullifier uniqueness
- Access control
- Fuzz testing

```bash
forge test -vvv
```

### TypeScript Tests

Tests for Poseidon hashing, utility functions, and Sybil resistance properties:

```bash
bun test
```

## References

- [zkVerify Documentation](https://docs.zkverify.io/)
- [zkVerifyJS SDK](https://github.com/zkVerify/zkverifyjs)
- [Circom Documentation](https://docs.circom.io/)
- [Foundry Book](https://book.getfoundry.sh/)
- [snarkjs](https://github.com/iden3/snarkjs)
