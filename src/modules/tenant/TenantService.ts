import crypto from 'crypto';
import { db } from '../../infra/db';
import { encryptSymmetric, decryptSymmetric } from '../../utils/encryption';
import { config } from '../../infra/config/env';
import { KeyManager } from '../key-management/KeyManager';

export class TenantService {
    static async createTenant(name: string, email: string, predefinedKey?: string) {
        const apiKey = predefinedKey || `sk_live_${crypto.randomBytes(24).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
        
        const nameEncrypted = encryptSymmetric(name);
        const emailToken = crypto.createHmac('sha3-256', Buffer.from(config.masterKey, 'hex')).update(email).digest('hex');

        const res = await db.query(`
            INSERT INTO tenants (name_encrypted, email_token, api_key_hash)
            VALUES ($1, $2, $3) RETURNING id
        `, [nameEncrypted, emailToken, apiKeyHash]);

        const tenantId = res.rows[0].id;
        
        // Gera as chaves criptográficas híbridas exclusivas para este novo cliente
        await KeyManager.rotateKeys(tenantId);

        return { tenantId, apiKey };
    }

    static async getTenants() {
        const res = await db.query('SELECT id, name_encrypted, created_at FROM tenants ORDER BY created_at DESC');
        return res.rows.map(row => ({
            id: row.id,
            name: decryptSymmetric(row.name_encrypted),
            created_at: row.created_at
        }));
    }
}