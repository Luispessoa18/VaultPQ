export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

export interface SignatureResult {
    signature: string;
    algorithm: string;
}

export interface HybridSignatureResult {
    classical_signature: string;
    pq_signature: string;
    key_version: string;
}

export interface CryptoProvider {
    sign(data: Buffer): Promise<SignatureResult | HybridSignatureResult>;
    verify(data: Buffer, signature: any): Promise<boolean>;
    generateKeyPair(): Promise<KeyPair>;
    getKeyVersion(): string;
}