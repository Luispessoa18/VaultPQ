import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../infra/config/env';

export function portalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado. Sessão ausente.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, config.masterKey.slice(0, 32)) as any;
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Sessão expirada devido a inatividade (5 minutos).' });
    }
}