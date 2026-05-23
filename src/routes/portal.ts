import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { portalAuthMiddleware } from '../middlewares/portalAuth.middleware';
import { TenantService } from '../modules/tenant/TenantService';
import { db } from '../infra/db';
import { decryptSymmetric } from '../utils/encryption';

export const portalRouter = Router();

portalRouter.use(portalAuthMiddleware);

portalRouter.post('/tenants', async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.user?.role !== 'admin') return res.status(403).json({ error: "Permissão negada. Apenas administradores." });
        
        const schema = z.object({ name: z.string().min(2), email: z.string().email() });
        const { name, email } = schema.parse(req.body);
        
        const result = await TenantService.createTenant(name, email);
        res.status(201).json({
            message: "Tenant criado com sucesso. Guarde a API Key, ela não será exibida novamente.",
            ...result
        });
    } catch (e) { next(e); }
});

portalRouter.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user?.role;
        const tenantId = req.user?.id;

        if (role === 'admin') {
            const tenants = await TenantService.getTenants();
            const logsRes = await db.query(`
                SELECT a.method, a.endpoint, a.status_code, a.response_time_ms, a.created_at, t.name_encrypted 
                FROM api_logs a JOIN tenants t ON a.tenant_id = t.id ORDER BY a.created_at DESC LIMIT 50
            `);

            const logs = logsRes.rows.map(row => ({
                ...row,
                tenant_name: decryptSymmetric(row.name_encrypted)
            }));

            res.json({ role: 'admin', total_tenants: tenants.length, tenants, recent_logs: logs });
        } else {
            // Se for Tenant, ele vê apenas os próprios dados, blindado de outros inquilinos.
            const logsRes = await db.query(`
                SELECT method, endpoint, status_code, response_time_ms, created_at 
                FROM api_logs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50
            `, [tenantId]);

            const logs = logsRes.rows.map(row => ({
                ...row, tenant_name: 'Você (Seguro)'
            }));

            res.json({ role: 'tenant', total_tenants: 0, tenants: [], recent_logs: logs });
        }
    } catch (e) { next(e); }
});