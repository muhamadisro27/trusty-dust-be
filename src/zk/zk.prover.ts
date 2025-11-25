import { Injectable, Logger } from '@nestjs/common';
import initNoirWasm, { Noir } from '@noir-lang/noir_wasm';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { ZkCompiler } from './zk.compiler';
import { ZkProofResult, ZkWitnessInput } from './zk.types';
import { bufferToHex } from './zk.utils';

@Injectable()
export class ZkProver {
  private readonly logger = new Logger(ZkProver.name);
  private noir?: Noir;
  private backend?: BarretenbergBackend;

  constructor(private readonly compiler: ZkCompiler) {}

  private async ensureInitialized() {
    if (!this.noir) {
      await initNoirWasm();
      this.noir = new Noir(await this.compiler.getAcir());
    }

    if (!this.backend) {
      this.backend = new BarretenbergBackend(await this.compiler.getCompiledCircuit());
    }
  }

  async createWitness(input: ZkWitnessInput) {
    await this.ensureInitialized();
    this.logger.debug(`Creating witness for score ${input.score} and minScore ${input.minScore}`);
    return this.noir!.execute(input as any);
  }

  async generateProof(input: ZkWitnessInput): Promise<ZkProofResult> {
    await this.ensureInitialized();
    this.logger.log('Generating Noir proof via backend');
    const execution = await this.createWitness(input);
    const proofData = await this.backend!.generateProof(execution.witness);

    return {
      proof: bufferToHex(proofData.proof),
      publicInputs: proofData.publicInputs,
    };
  }
}
