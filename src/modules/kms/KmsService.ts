import crypto from 'crypto';
import { KeyManager } from '../key-management/KeyManager';
const secrets = require('secrets.js-grempe');

export class KmsService {
    // Retorna a chave AES 256 de forma consistente a partir do HMAC Secret
    private static getEncryptionKey(hmacSecret: string): Buffer {
        return Buffer.from(hmacSecret, 'hex').slice(0, 32);
    }

    /**
     * Equivalente ao AWS KMS Encrypt. Criptografa o dado com a Master Key do Tenant.
     */
    static async encryptData(tenantId: string, plaintext: string): Promise<string> {
        const { provider, hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        const version = provider.getKeyVersion();
        const encryptionKey = this.getEncryptionKey(hmacSecret);
        
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
        
        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        const authTag = cipher.getAuthTag().toString('base64');
        
        return `${iv.toString('base64')}:${authTag}:${encrypted}:${version}`;
    }

    /**
     * Equivalente ao AWS KMS Decrypt. Localiza a versão da chave que criptografou e reverte.
     */
    static async decryptData(tenantId: string, ciphertextBlob: string): Promise<string> {
        const parts = ciphertextBlob.split(':');
        if (parts.length !== 4) throw new Error("Formato de Ciphertext KMS inválido.");
        
        const [ivBase64, authTagBase64, encryptedBase64, version] = parts;
        
        const { hmacSecret } = await KeyManager.getProviderByVersion(tenantId, version);
        const decryptionKey = this.getEncryptionKey(hmacSecret);

        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-256-gcm', decryptionKey, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Equivalente ao AWS KMS GenerateDataKey. Gera uma Data Key (256-bit) e retorna a versão plana e criptografada.
     */
    static async generateDataKey(tenantId: string) {
        const { provider, hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        const version = provider.getKeyVersion();

        const plainDataKey = crypto.randomBytes(32).toString('hex');
        
        const encryptionKey = this.getEncryptionKey(hmacSecret);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
        
        let encryptedKey = cipher.update(plainDataKey, 'utf8', 'base64');
        encryptedKey += cipher.final('base64');
        const authTag = cipher.getAuthTag().toString('base64');

        return {
            key_version: version,
            plaintext: plainDataKey,
            ciphertext_blob: `${iv.toString('base64')}:${authTag}:${encryptedKey}:${version}`
        };
    }

    /**
     * Exporta as chaves do Tenant em partes usando Shamir Secret Sharing, impedindo Key Extraction única.
     */
    static async generateShamirBackup(tenantId: string, totalShares: number = 3, threshold: number = 2) {
        if (threshold > totalShares) throw new Error("Threshold não pode ser maior que o total de partes (shares).");
        
        const { hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        
        // Separa o segredo do tenant (hex) em várias partes
        const shares = secrets.share(hmacSecret, totalShares, threshold);
        
        return {
            status: "Backup Criado via Shamir Secret Sharing",
            instruction: `Para reconstruir a chave, são necessárias ${threshold} destas ${totalShares} partes. Guarde-as separadamente (ex: AWS, Cofre Físico, Diretor A).`,
            shares
        };
    }
}