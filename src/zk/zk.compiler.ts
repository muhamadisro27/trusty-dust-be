import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CompiledCircuit, Abi } from '@noir-lang/types';
import { CIRCUIT_BUILD, CIRCUIT_FILES, readAcirBuffer } from './zk.utils';

interface CircuitManifest {
  name: string;
  backend: string;
  commit_hash?: string;
}

@Injectable()
export class ZkCompiler implements OnModuleInit {
  private readonly logger = new Logger(ZkCompiler.name);
  private acir?: Uint8Array;
  private circuitManifest?: CircuitManifest;
  private provingKey?: Uint8Array;
  private verificationKey?: Uint8Array;
  private compiledCircuit?: CompiledCircuit;

  async onModuleInit() {
    try {
      await this.loadArtifacts();
    } catch (error) {
      this.logger.warn(`Unable to eagerly load circuit artifacts: ${error}`);
    }
  }

  async loadArtifacts() {
    const acirUncompressed = readAcirBuffer();
    this.acir = acirUncompressed;
    this.circuitManifest = JSON.parse(
      readFileSync(join(CIRCUIT_BUILD, CIRCUIT_FILES.circuit), 'utf-8'),
    ) as CircuitManifest;
    this.provingKey = readFileSync(
      join(CIRCUIT_BUILD, CIRCUIT_FILES.provingKey),
    );
    this.verificationKey = readFileSync(
      join(CIRCUIT_BUILD, CIRCUIT_FILES.verificationKey),
    );
    this.compiledCircuit = {
      bytecode: Buffer.from(acirUncompressed).toString('base64'),
      abi: this.loadAbiFromCircuit(),
    };
    this.logger.log(
      `Circuit ${this.circuitManifest?.name ?? 'unknown'} loaded with backend ${this.circuitManifest?.backend ?? 'n/a'}`,
    );
  }

  async getAcir() {
    if (!this.acir) {
      await this.loadArtifacts();
    }
    return this.acir!;
  }

  async getProvingKey() {
    if (!this.provingKey) {
      await this.loadArtifacts();
    }
    return this.provingKey!;
  }

  async getVerificationKey() {
    if (!this.verificationKey) {
      await this.loadArtifacts();
    }
    return this.verificationKey!;
  }

  hasBuildArtifacts() {
    return existsSync(join(CIRCUIT_BUILD, CIRCUIT_FILES.acir));
  }

  private loadAbiFromCircuit(): Abi {
    const candidates = [
      join(CIRCUIT_BUILD, CIRCUIT_FILES.abi),
      join(CIRCUIT_BUILD, CIRCUIT_FILES.circuit),
    ];
    for (const path of candidates) {
      try {
        if (!existsSync(path)) {
          continue;
        }
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        if (data?.abi) {
          return data.abi as Abi;
        }
      } catch (error) {
        this.logger.warn(`Failed to parse ABI from ${path}: ${error}`);
      }
    }
    return {
      parameters: [],
      param_witnesses: {},
      return_type: null,
      return_witnesses: [],
      error_types: {},
    };
  }

  async getCompiledCircuit() {
    if (!this.compiledCircuit) {
      await this.loadArtifacts();
    }
    return this.compiledCircuit!;
  }
}
