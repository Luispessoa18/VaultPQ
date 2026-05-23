import { db } from '../../infra/db';

export class SchemaService {
    static async createSchema(tenantId: string, name: string, fields: Record<string, string>) {
        const res = await db.query(`
            INSERT INTO schemas (tenant_id, name, fields)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_id, name) 
            DO UPDATE SET fields = EXCLUDED.fields
            RETURNING *
        `, [tenantId, name, JSON.stringify(fields)]);
        return res.rows[0];
    }

    static async getSchema(tenantId: string, name: string) {
        const res = await db.query('SELECT fields FROM schemas WHERE tenant_id = $1 AND name = $2', [tenantId, name]);
        if (res.rows.length === 0) throw new Error(`Schema '${name}' não encontrado para este tenant.`);
        return res.rows[0].fields;
    }
}