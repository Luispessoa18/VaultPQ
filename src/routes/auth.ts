import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { db } from '../infra/db';
import { config } from '../infra/config/env';

export const authRouter = Router();

// Usamos uma fatia da Master Key como chave JWT interna para as sessões do Portal
const JWT_SECRET = config.masterKey.slice(0, 32);

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ error: "Credencial ausente." });

        // Identificação: Administrador
        if (key === config.adminApiKey) {
            const adminRes = await db.query("SELECT * FROM sys_admins WHERE username = 'admin'");
            const admin = adminRes.rows[0];
            
            if (!admin.totp_enabled) {
                const secret = authenticator.generateSecret();
                await db.query("UPDATE sys_admins SET totp_secret = $1 WHERE username = 'admin'", [secret]);
                const uri = authenticator.keyuri('admin@securevault.saas', 'SecureVault-Admin', secret);
                const qrcodeImage = await qrcode.toDataURL(uri);
                
                const tempToken = jwt.sign({ role: 'admin', setup: true }, JWT_SECRET, { expiresIn: '10m' });
                return res.json({ require_setup: true, qrcode: qrcodeImage, temp_token: tempToken });
            } else {
                const tempToken = jwt.sign({ role: 'admin', setup: false }, JWT_SECRET, { expiresIn: '10m' });
                return res.json({ require_setup: false, temp_token: tempToken });
            }
        }

        // Identificação: Tenant / Cliente
        const hash = crypto.createHash('sha256').update(key).digest('hex');
        const tenantRes = await db.query("SELECT id, totp_enabled FROM tenants WHERE api_key_hash = $1", [hash]);
        if (tenantRes.rows.length === 0) return res.status(401).json({ error: "Credencial inválida." });

        const tenant = tenantRes.rows[0];
        if (!tenant.totp_enabled) {
            const secret = authenticator.generateSecret();
            await db.query("UPDATE tenants SET totp_secret = $1 WHERE id = $2", [secret, tenant.id]);
            const uri = authenticator.keyuri('tenant@securevault.saas', 'SecureVault-Cliente', secret);
            const qrcodeImage = await qrcode.toDataURL(uri);
            
            const tempToken = jwt.sign({ role: 'tenant', id: tenant.id, setup: true }, JWT_SECRET, { expiresIn: '10m' });
            return res.json({ require_setup: true, qrcode: qrcodeImage, temp_token: tempToken });
        } else {
            const tempToken = jwt.sign({ role: 'tenant', id: tenant.id, setup: false }, JWT_SECRET, { expiresIn: '10m' });
            return res.json({ require_setup: false, temp_token: tempToken });
        }
    } catch (e) { next(e); }
});

authRouter.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { temp_token, code } = req.body;
        const decoded = jwt.verify(temp_token, JWT_SECRET) as any;
        
        let secret = '';
        if (decoded.role === 'admin') {
            const admin = await db.query("SELECT * FROM sys_admins WHERE username = 'admin'");
            secret = admin.rows[0].totp_secret;
        } else {
            const tenant = await db.query("SELECT totp_secret FROM tenants WHERE id = $1", [decoded.id]);
            secret = tenant.rows[0].totp_secret;
        }

        const isValid = authenticator.check(code, secret);
        if (!isValid) return res.status(401).json({ error: "Código TOTP (Google Authenticator) inválido." });

        if (decoded.setup) {
            if (decoded.role === 'admin') await db.query("UPDATE sys_admins SET totp_enabled = TRUE WHERE username = 'admin'");
            else await db.query("UPDATE tenants SET totp_enabled = TRUE WHERE id = $1", [decoded.id]);
        }

        const sessionToken = jwt.sign({ role: decoded.role, id: decoded.id }, JWT_SECRET, { expiresIn: '5m' });
        return res.json({ session_token: sessionToken, role: decoded.role });
    } catch (e) { return res.status(401).json({ error: "Token temporário expirado ou violado." }); }
});

authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) return res.status(401).json({ error: "Acesso negado." });
        
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        const sessionToken = jwt.sign({ role: decoded.role, id: decoded.id }, JWT_SECRET, { expiresIn: '5m' });
        res.json({ session_token: sessionToken });
    } catch (e) { return res.status(401).json({ error: "Sessão inativa por mais de 5 minutos. Favor reconectar." }); }
});