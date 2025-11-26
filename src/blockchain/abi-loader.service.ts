import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Abi } from 'viem';

@Injectable()
export class AbiLoaderService {
  private readonly cache = new Map<string, Abi>();

  loadAbi(fileName: string): Abi {
    if (this.cache.has(fileName)) {
      return this.cache.get(fileName)!;
    }

    const filePath = join(process.cwd(), 'src', 'abis', fileName);
    const abi = JSON.parse(readFileSync(filePath, 'utf-8')) as Abi;
    this.cache.set(fileName, abi);
    return abi;
  }
}
