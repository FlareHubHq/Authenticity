import { zkVerifySession, Library, CurveType, ZkVerifyEvents } from "zkverifyjs";

type ZkVerifySession = InstanceType<typeof zkVerifySession>;

export interface ProofData {
  proof: object;
  publicSignals: string[];
  vk: object;
}

export interface StatementPath {
  leaf: string;
  merklePath: string[];
  leafCount: number;
  index: number;
}

export interface VerificationResult {
  success: boolean;
  txHash?: string;
  aggregationId?: number;
  statementPath?: StatementPath;
  error?: string;
}

export class ZkVerifyService {
  private session: ZkVerifySession | null = null;
  private readonly seedPhrase: string;
  private readonly domainId: number;

  constructor(seedPhrase: string, domainId = 0) {
    this.seedPhrase = seedPhrase;
    this.domainId = domainId;
  }

  async connect(): Promise<void> {
    this.session = await zkVerifySession.start().Volta().withAccount(this.seedPhrase);
    console.log("[ZkVerify] Connected to Volta testnet");
  }

  private async ensureSession(): Promise<ZkVerifySession> {
    if (!this.session) {
      await this.connect();
    }

    if (!this.session) {
      throw new Error("Failed to initialize zkVerify session");
    }

    return this.session;
  }

  async submitProof(proofData: ProofData): Promise<VerificationResult> {
    const session = await this.ensureSession();

    try {
      console.log("[ZkVerify] Submitting proof...");
      
      const { events, transactionResult } = await session
        .verify()
        .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
        .execute({
          proofData: {
            vk: proofData.vk,
            proof: proofData.proof,
            publicSignals: proofData.publicSignals,
          },
          domainId: this.domainId,
        });

      return new Promise((resolve) => {
        events.on(ZkVerifyEvents.IncludedInBlock, (eventData: unknown) => {
          console.log("[ZkVerify] Included in block:", eventData);
        });

        events.on(ZkVerifyEvents.Finalized, (eventData: unknown) => {
          console.log("[ZkVerify] Finalized:", eventData);
          const txHash = extractStringProp(eventData, "txHash");
          resolve({
            success: true,
            txHash,
          });
        });

        events.on("error", (error: unknown) => {
          console.error("[ZkVerify] Error:", error);
          resolve({
            success: false,
            error: toErrorMessage(error),
          });
        });

        transactionResult.then((info: unknown) => {
          console.log("[ZkVerify] Transaction completed:", info);
        }).catch((err: unknown) => {
          resolve({
            success: false,
            error: toErrorMessage(err),
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async registerVerificationKey(vk: object): Promise<{ vkHash: string } | null> {
    const session = await this.ensureSession();

    try {
      console.log("[ZkVerify] Registering verification key...");
      const result = await session.registerVerificationKey()
        .groth16({ library: Library.snarkjs, curve: CurveType.bn128 })
        .execute(vk);
      
      const vkHash = extractStringProp(result, "vkHash");
      if (!vkHash) {
        throw new Error("VK registration did not return vkHash");
      }

      console.log("[ZkVerify] VK registered, hash:", vkHash);
      return { vkHash };
    } catch (error) {
      console.error("[ZkVerify] Failed to register VK:", error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
      console.log("[ZkVerify] Disconnected");
    }
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function hasStringProp(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && key in value;
}

function extractStringProp(value: unknown, key: string): string | undefined {
  if (!hasStringProp(value, key)) return undefined;
  const prop = value[key];
  return typeof prop === "string" ? prop : undefined;
}