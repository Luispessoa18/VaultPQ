import { Request, Response, NextFunction } from 'express';
import { db } from '../infra/db';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // Só registramos métricas se for uma requisição de tenant autenticado
        if (req.tenantId) {
            db.query(`
                INSERT INTO api_logs (tenant_id, method, endpoint, status_code, response_time_ms)
                VALUES ($1, $2, $3, $4, $5)
            `, [req.tenantId, req.method, req.path, res.statusCode, duration])
            .catch(e => console.error("Falha ao salvar métrica de log:", e.message));
        }
    });

    next();
}