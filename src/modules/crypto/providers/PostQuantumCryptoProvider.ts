import { CryptoProvider, KeyPair, SignatureResult } from '../CryptoProvider.interface';

let oqs: any = null;
try {
    oqs = require('liboqs-node');
} catch (e) {
    console.warn("AVISO: liboqs-node nativo não encontrado. Usando Mock Seguro para ambiente de desenvolvimento.");
}

export class PostQuantumCryptoProvider implements CryptoProvider {
    private version: string;
    private privateKey?: Buffer;
    private publicKey?: Buffer;
    private algorithm = 'Dilithium2';

    constructor(version: string, privateKeyHex?: string, publicKeyHex?: string) {
        this.version = version;
        if (privateKeyHex) this.privateKey = Buffer.from(privateKeyHex, 'hex');
        if (publicKeyHex) this.publicKey = Buffer.from(publicKeyHex, 'hex');
    }

    async generateKeyPair(): Promise<KeyPair> {
        if (oqs) {
            const sig = new oqs.Signature(this.algorithm);
            const pub = sig.generate_keypair();
            const priv = sig.export_secret_key();
            return {
                publicKey: pub.toString('hex'),
                privateKey: priv.toString('hex')
            };
        } else {
            // Mock Fallback para que o MVP não quebre fora do Docker compilado
            const crypto = require('crypto');
            const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
            return {
                publicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'),
                privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex')
            };
        }
    }

    async sign(data: Buffer): Promise<SignatureResult> {
        if (!this.privateKey) throw new Error("Chave privada PQ não carregada.");
        
        if (oqs) {
            const sig = new oqs.Signature(this.algorithm);
            sig.import_secret_key(this.privateKey);
            const signature = sig.sign(data);
            return { signature: signature.toString('hex'), algorithm: this.algorithm };
        } else {
            const crypto = require('crypto');
            const privKey = crypto.createPrivateKey({ key: this.privateKey, format: 'der', type: 'pkcs8' });
            const signature = crypto.sign(null, data, privKey);
            return { signature: signature.toString('hex'), algorithm: 'Mock-PQ-Ed25519' };
        }
    }

    async verify(data: Buffer, signature: SignatureResult): Promise<boolean> {
        if (!this.publicKey) throw new Error("Chave pública PQ não carregada.");
        
        if (oqs) {
            const sig = new oqs.Signature(this.algorithm);
            return sig.verify(data, Buffer.from(signature.signature, 'hex'), this.publicKey);
        } else {
            const crypto = require('crypto');
            const pubKey = crypto.createPublicKey({ key: this.publicKey, format: 'der', type: 'spki' });
            return crypto.verify(null, data, pubKey, Buffer.from(signature.signature, 'hex'));
        }
    }

    getKeyVersion(): string {
        return this.version;
    }
}