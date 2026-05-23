import { db } from '../../infra/db';
import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '../../infra/config/env';
import { KeyManager } from '../key-management/KeyManager';
import { SchemaService } from '../schema/SchemaService';

export class RecordService {
    static async processRecord(tenantId: string, schemaName: string, data: Record<string, any>) {
        const schemaFields = await SchemaService.getSchema(tenantId, schemaName);
        const { provider, hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        const version = provider.getKeyVersion();

        // Derivando uma chave AES de 256 bits a partir do HMAC Secret do Tenant
        const encryptionKey = Buffer.from(hmacSecret, 'hex').slice(0, 32);

        const securePayload: Record<string, string> = {};

        for (const [field, policy] of Object.entries(schemaFields)) {
            const rawValue = data[field];
            if (!rawValue) continue;

            const strValue = String(rawValue);

            if (policy === 'token' || policy === 'token+encrypt') {
                const hmac = crypto.createHmac('sha3-512', Buffer.from(hmacSecret, 'hex'));
                hmac.update(strValue);
                const token = hmac.digest('hex');
                securePayload[`${field}_token`] = token;

                // Registra o token no mapa do Vault
                await db.query(`
                    INSERT INTO token_map (tenant_id, token, type, key_version)
                    VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
                `, [tenantId, token, field, version]);
            }

            if (policy === 'encrypt' || policy === 'token+encrypt') {
                const iv = crypto.randomBytes(12);
                const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
                let encrypted = cipher.update(strValue, 'utf8', 'base64');
                encrypted += cipher.final('base64');
                const authTag = cipher.getAuthTag().toString('base64');
                
                securePayload[`${field}_cipher`] = `${iv.toString('base64')}:${authTag}:${encrypted}:${version}`;
            }

            if (policy === 'password') {
                // Argon2id com memória e processamento elevados + Pepper
                const hash = await argon2.hash(strValue + config.passwordPepper, {
                    type: argon2.argon2id,
                    memoryCost: 2 ** 16, // 64 MB
                    timeCost: 3,
                    parallelism: 1
                });
                securePayload[`${field}_hash`] = hash;
            }
        }

        return {
            record_id: `rec_${crypto.randomBytes(8).toString('hex')}`,
            key_version: version,
            secure_payload: securePayload
        };
    }

    static async verifyPassword(plainPassword: string, hashFromDb: string): Promise<boolean> {
        try {
            return await argon2.verify(hashFromDb, plainPassword + config.passwordPepper);
        } catch (e) {
            return false;
        }
    }
}