import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../infra/db';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || typeof apiKey !== 'string') {
        return res.status(401).json({ error: 'Unauthorized: API Key ausente.' });
    }

    try {
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const dbRes = await db.query('SELECT id FROM tenants WHERE api_key_hash = $1', [hash]);
        
        if (dbRes.rows.length === 0) {
            return res.status(401).json({ error: 'Unauthorized: API Key inválida.' });
        }

        req.tenantId = dbRes.rows[0].id;
        next();
    } catch (err) {
        next(err);
    }
}