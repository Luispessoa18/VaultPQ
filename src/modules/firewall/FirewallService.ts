import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { KeyManager } from '../key-management/KeyManager';

export class FirewallService {
    static async issueToken(tenantId: string) {
        const { provider, hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        
        const payload = {
            sub: tenantId,
            key_version: provider.getKeyVersion(),
            type: 'Firewall_mTLS_Proxy'
        };

        // Assinatura JWT ultrassegura usando o Segredo do Vault
        const token = jwt.sign(payload, Buffer.from(hmacSecret, 'hex'), {
            algorithm: 'HS512',
            expiresIn: '15m'
        });

        return { token, expires_in: 900, key_version: provider.getKeyVersion() };
    }

    static async verifyRequestSignature(tenantId: string, body: any, nonce: string, timestamp: string, signature: string) {
        const { hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        
        // Concatena Body (se existir) + Nonce + Timestamp
        const payloadToSign = (body && Object.keys(body).length > 0 ? JSON.stringify(body) : '') + nonce + timestamp;
        
        const expectedSignature = crypto.createHmac('sha3-512', Buffer.from(hmacSecret, 'hex'))
                                       .update(payloadToSign)
                                       .digest('hex');
        
        const bufSig = Buffer.from(signature, 'hex');
        const bufExp = Buffer.from(expectedSignature, 'hex');
        
        if (bufSig.length !== bufExp.length || !crypto.timingSafeEqual(bufSig, bufExp)) {
            throw new Error("Assinatura do Request inválida. Modificação de payload ou falha de chave detectada.");
        }
        
        return true;
    }
}