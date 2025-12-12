import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { flareTestnet, flare } from "viem/chains";

const REGISTRY_ABI = parseAbi([
  "function initialize(address _zkVerifyContract, uint256 _domainId) external",
  "function verifyAuthenticity(bytes32 commitment, bytes32 nullifier, uint256 aggregationId, bytes32 leaf, bytes32[] calldata merklePath, uint256 leafCount, uint256 index) external",
  "function isVerified(address user) external view returns (bool)",
  "function getVerification(address user) external view returns (bytes32 commitment, uint256 timestamp, bool verified)",
  "function setZkVerifyContract(address _zkVerifyContract) external",
  "function setDomainId(uint256 _domainId) external",
  "event AuthenticityVerified(address indexed user, bytes32 indexed commitment, bytes32 indexed nullifier, uint256 aggregationId)",
]);

interface DeployConfig {
  zkVerifyContractAddress: string;
  domainId: number;
  useTestnet: boolean;
}

async function deploy(config: DeployConfig) {
  console.log("=== FlareHub Authenticity Registry Deployment ===\n");

  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chain = config.useTestnet ? flareTestnet : flare;

  console.log("Network:", chain.name);
  console.log("Deployer:", account.address);
  console.log("zkVerify Contract:", config.zkVerifyContractAddress);
  console.log("Domain ID:", config.domainId);
  console.log("");

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Deployer balance:", (Number(balance) / 1e18).toFixed(4), "FLR");

  if (balance === 0n) {
    throw new Error("Deployer has no balance");
  }

  console.log("\nDeployment commands (using Foundry):");
  console.log("");
  console.log("  # Deploy implementation");
  console.log("  forge create src/FlareHubAuthenticityRegistry.sol:FlareHubAuthenticityRegistry \\");
  console.log("    --rpc-url $FLARE_RPC \\");
  console.log("    --private-key $DEPLOYER_PRIVATE_KEY");
  console.log("");
  console.log("  # Deploy proxy and initialize");
  console.log("  forge create lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy \\");
  console.log(`    --constructor-args <IMPL_ADDRESS> $(cast abi-encode "initialize(address,uint256)" ${config.zkVerifyContractAddress} ${config.domainId}) \\`);
  console.log("    --rpc-url $FLARE_RPC \\");
  console.log("    --private-key $DEPLOYER_PRIVATE_KEY");
}

async function main() {
  const config: DeployConfig = {
    zkVerifyContractAddress: process.env.ZKVERIFY_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000",
    domainId: parseInt(process.env.ZKVERIFY_DOMAIN_ID || "0"),
    useTestnet: process.env.USE_TESTNET !== "false",
  };

  await deploy(config);
}

main().catch(console.error);
