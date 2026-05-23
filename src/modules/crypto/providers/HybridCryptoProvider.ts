import { CryptoProvider, HybridSignatureResult } from '../CryptoProvider.interface';
import { ClassicalCryptoProvider } from './ClassicalCryptoProvider';
import { PostQuantumCryptoProvider } from './PostQuantumCryptoProvider';

export class HybridCryptoProvider implements CryptoProvider {
    private version: string;
    private classicalProvider: ClassicalCryptoProvider;
    private pqProvider: PostQuantumCryptoProvider;

    constructor(
        version: string, 
        classicalPriv?: string, classicalPub?: string, 
        pqPriv?: string, pqPub?: string
    ) {
        this.version = version;
        this.classicalProvider = new ClassicalCryptoProvider(version, classicalPriv, classicalPub);
        this.pqProvider = new PostQuantumCryptoProvider(version, pqPriv, pqPub);
    }

    async init() {
        await this.classicalProvider.init();
    }

    async generateKeyPair(): Promise<any> {
        throw new Error("Use KeyManager para gerenciar chaves híbridas.");
    }

    async sign(data: Buffer): Promise<HybridSignatureResult> {
        const classical = await this.classicalProvider.sign(data);
        const pq = await this.pqProvider.sign(data);

        return {
            classical_signature: classical.signature,
            pq_signature: pq.signature,
            key_version: this.version
        };
    }

    async verify(data: Buffer, signature: HybridSignatureResult): Promise<boolean> {
        const classicalValid = await this.classicalProvider.verify(data, { signature: signature.classical_signature, algorithm: 'Ed25519' });
        const pqValid = await this.pqProvider.verify(data, { signature: signature.pq_signature, algorithm: 'Dilithium2' });

        return classicalValid && pqValid;
    }

    getKeyVersion(): string {
        return this.version;
    }
}