import { db } from '../../infra/db';
import crypto from 'crypto';
import { KeyManager } from '../key-management/KeyManager';

export class TokenService {
    static async tokenize(tenantId: string, value: string, type: string = 'generic'): Promise<string> {
        const { provider, hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        const version = provider.getKeyVersion();

        const hmac = crypto.createHmac('sha3-512', Buffer.from(hmacSecret, 'hex'));
        hmac.update(value);
        const token = hmac.digest('hex');

        await db.query(`
            INSERT INTO token_map (tenant_id, token, type, key_version)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (tenant_id, token) DO NOTHING
        `, [tenantId, token, type, version]);

        return token;
    }
}