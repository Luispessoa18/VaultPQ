import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { KeyManager } from '../modules/key-management/KeyManager';
import { FirewallService } from '../modules/firewall/FirewallService';
import { logger } from '../utils/logger';

// Cache in-memory para Nonces (Em prod escalável usamos Redis)
const nonceCache = new Map<string, number>();

export async function apiFirewall(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers['authorization'];
        const nonce = req.headers['x-nonce'] as string;
        const timestamp = req.headers['x-timestamp'] as string;
        const signature = req.headers['x-signature'] as string;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Firewall Block: Faltando Authorization Bearer JWT." });
        }

        if (!nonce || !timestamp || !signature) {
            return res.status(400).json({ error: "Firewall Block: Faltando cabeçalhos de proteção anti-replay e assinatura." });
        }

        // 1. Anti-Replay: Validação de Janela de Tempo (Max 60s)
        const reqTime = parseInt(timestamp);
        const now = Date.now();
        if (isNaN(reqTime) || Math.abs(now - reqTime) > 60000) {
            return res.status(403).json({ error: "Firewall Block: Replay Attack Detectado - Request muito antigo ou futuro." });
        }

        // 2. Anti-Replay: Validação de Nonce
        if (nonceCache.has(nonce)) {
            return res.status(403).json({ error: "Firewall Block: Replay Attack Detectado - Nonce já utilizado." });
        }
        nonceCache.set(nonce, now);
        
        // Garbage Collector do Cache de Nonces
        for (const [k, v] of nonceCache.entries()) {
            if (now - v > 60000) nonceCache.delete(k);
        }

        // 3. Validação de JWT Assinado (Permite Rotação Automática de Chave)
        const token = authHeader.split(' ')[1];
        const decodedInfo = jwt.decode(token) as any;
        if (!decodedInfo || !decodedInfo.sub) return res.status(401).json({ error: "Firewall Block: JWT malformado." });
        
        const tenantId = decodedInfo.sub;
        const { hmacSecret } = await KeyManager.getActiveProvider(tenantId);
        
        try {
            jwt.verify(token, Buffer.from(hmacSecret, 'hex'), { algorithms: ['HS512'] });
        } catch (err: any) {
            return res.status(401).json({ error: `Firewall Block: JWT Inválido ou Expirado. (${err.message})` });
        }

        // 4. Detecção de Interceptação MITM (Assinatura do Body)
        await FirewallService.verifyRequestSignature(tenantId, req.body, nonce, timestamp, signature);

        // Cliente totalmente validado.
        req.tenantId = tenantId;
        next();
    } catch (err: any) {
        logger.warn(`Firewall interceptou ameaça: ${err.message}`, { path: req.path, ip: req.ip });
        return res.status(403).json({ error: `Firewall Blocked: ${err.message}` });
    }
}