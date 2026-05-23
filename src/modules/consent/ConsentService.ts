import { db } from '../../infra/db';
import crypto from 'crypto';
import { KeyManager } from '../key-management/KeyManager';

export class ConsentService {
    static async recordConsent(tenantId: string, userToken: string, policyText: string, policyVersion: string) {
        const { provider } = await KeyManager.getActiveProvider(tenantId);

        const policyHash = crypto.createHash('sha3-512').update(policyText).digest('hex');

        const lastRes = await db.query('SELECT record_hash FROM consent WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', [tenantId]);
        const previousHash = lastRes.rows.length > 0 ? lastRes.rows[0].record_hash : 'GENESIS';

        const consentBase = {
            tenant_id: tenantId,
            user_token: userToken,
            policy_hash: policyHash,
            policy_version: policyVersion,
            previous_hash: previousHash
        };

        const recordHash = crypto.createHash('sha3-512').update(JSON.stringify(consentBase)).digest('hex');

        const signature = await provider.sign(Buffer.from(recordHash, 'hex'));

        const insertRes = await db.query(`
            INSERT INTO consent (
                tenant_id, user_token, policy_hash, policy_version, classical_signature, 
                pq_signature, key_version, previous_hash, record_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
        `, [
            tenantId, userToken, policyHash, policyVersion, signature.classical_signature,
            signature.pq_signature, signature.key_version, previousHash, recordHash
        ]);

        return {
            id: insertRes.rows[0].id,
            record_hash: recordHash,
            signatures: signature
        };
    }

    static async verifyConsent(tenantId: string, id: string): Promise<boolean> {
        const res = await db.query('SELECT * FROM consent WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
        if (res.rows.length === 0) throw new Error("Consentimento não encontrado para este tenant.");

        const consent = res.rows[0];

        const consentBase = {
            tenant_id: consent.tenant_id,
            user_token: consent.user_token,
            policy_hash: consent.policy_hash,
            policy_version: consent.policy_version,
            previous_hash: consent.previous_hash
        };

        const calculatedRecordHash = crypto.createHash('sha3-512').update(JSON.stringify(consentBase)).digest('hex');
        if (calculatedRecordHash !== consent.record_hash) {
            throw new Error("Violação de Imutabilidade: Hash do registro não confere.");
        }

        const { provider } = await KeyManager.getProviderByVersion(tenantId, consent.key_version);

        const isValid = await provider.verify(Buffer.from(calculatedRecordHash, 'hex'), {
            classical_signature: consent.classical_signature,
            pq_signature: consent.pq_signature,
            key_version: consent.key_version
        });

        if (!isValid) {
            throw new Error("Violação de Assinatura: Assinatura Híbrida inválida.");
        }

        return true;
    }
}