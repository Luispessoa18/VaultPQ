import sodium from 'libsodium-wrappers';
import { CryptoProvider, KeyPair, SignatureResult } from '../CryptoProvider.interface';

export class ClassicalCryptoProvider implements CryptoProvider {
    private version: string;
    private privateKey?: Uint8Array;
    private publicKey?: Uint8Array;

    constructor(version: string, privateKeyHex?: string, publicKeyHex?: string) {
        this.version = version;
        if (privateKeyHex) this.privateKey = Buffer.from(privateKeyHex, 'hex');
        if (publicKeyHex) this.publicKey = Buffer.from(publicKeyHex, 'hex');
    }

    async init() {
        await sodium.ready;
    }

    async generateKeyPair(): Promise<KeyPair> {
        await sodium.ready;
        const keypair = sodium.crypto_sign_keypair();
        return {
            publicKey: Buffer.from(keypair.publicKey).toString('hex'),
            privateKey: Buffer.from(keypair.privateKey).toString('hex')
        };
    }

    async sign(data: Buffer): Promise<SignatureResult> {
        await sodium.ready;
        if (!this.privateKey) throw new Error("Chave privada clássica não carregada.");
        const sig = sodium.crypto_sign_detached(data, this.privateKey);
        return {
            signature: Buffer.from(sig).toString('hex'),
            algorithm: 'Ed25519'
        };
    }

    async verify(data: Buffer, signature: SignatureResult): Promise<boolean> {
        await sodium.ready;
        if (!this.publicKey) throw new Error("Chave pública clássica não carregada.");
        const sigBuffer = Buffer.from(signature.signature, 'hex');
        return sodium.crypto_sign_verify_detached(sigBuffer, data, this.publicKey);
    }

    getKeyVersion(): string {
        return this.version;
    }
}