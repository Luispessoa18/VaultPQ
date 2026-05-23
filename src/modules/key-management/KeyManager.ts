import { db } from '../../infra/db';
import { encryptSymmetric, decryptSymmetric } from '../../utils/encryption';
import { ClassicalCryptoProvider } from '../crypto/providers/ClassicalCryptoProvider';
import { PostQuantumCryptoProvider } from '../crypto/providers/PostQuantumCryptoProvider';
import { HybridCryptoProvider } from '../crypto/providers/HybridCryptoProvider';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

export class KeyManager {
    static async rotateKeys(tenantId: string): Promise<string> {
        const version = `v${Date.now()}`;
        
        const classical = new ClassicalCryptoProvider(version);
        await classical.init();
        const classicalKeys = await classical.generateKeyPair();
        
        const pq = new PostQuantumCryptoProvider(version);
        const pqKeys = await pq.generateKeyPair();

        const hmacSecret = crypto.randomBytes(64).toString('hex');

        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            await client.query('UPDATE keys SET active = FALSE WHERE tenant_id = $1 AND active = TRUE', [tenantId]);

            await client.query(`
                INSERT INTO keys (
                    tenant_id, version, classical_public_key, classical_private_key_encrypted, 
                    pq_public_key, pq_private_key_encrypted, hmac_secret_encrypted, active
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
            `, [
                tenantId,
                version,
                classicalKeys.publicKey,
                encryptSymmetric(classicalKeys.privateKey),
                pqKeys.publicKey,
                encryptSymmetric(pqKeys.privateKey),
                encryptSymmetric(hmacSecret)
            ]);

            await client.query('COMMIT');
            logger.info(`Rotação de chaves executada para tenant ${tenantId}. Nova versão: ${version}`);
            return version;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    static async getActiveProvider(tenantId: string): Promise<{ provider: HybridCryptoProvider, hmacSecret: string }> {
        const res = await db.query('SELECT * FROM keys WHERE tenant_id = $1 AND active = TRUE LIMIT 1', [tenantId]);
        if (res.rows.length === 0) {
            await this.rotateKeys(tenantId);
            return this.getActiveProvider(tenantId);
        }

        const key = res.rows[0];
        const provider = new HybridCryptoProvider(
            key.version,
            decryptSymmetric(key.classical_private_key_encrypted),
            key.classical_public_key,
            decryptSymmetric(key.pq_private_key_encrypted),
            key.pq_public_key
        );
        await provider.init();

        return {
            provider,
            hmacSecret: decryptSymmetric(key.hmac_secret_encrypted)
        };
    }

    static async getProviderByVersion(tenantId: string, version: string): Promise<{ provider: HybridCryptoProvider, hmacSecret: string }> {
        const res = await db.query('SELECT * FROM keys WHERE tenant_id = $1 AND version = $2', [tenantId, version]);
        if (res.rows.length === 0) throw new Error("Versão da chave não encontrada para este tenant.");

        const key = res.rows[0];
        const provider = new HybridCryptoProvider(
            key.version,
            decryptSymmetric(key.classical_private_key_encrypted),
            key.classical_public_key,
            decryptSymmetric(key.pq_private_key_encrypted),
            key.pq_public_key
        );
        await provider.init();
        return {
            provider,
            hmacSecret: decryptSymmetric(key.hmac_secret_encrypted)
        };
    }
}