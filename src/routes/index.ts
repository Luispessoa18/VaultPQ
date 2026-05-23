import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { KeyManager } from '../modules/key-management/KeyManager';
import { TokenService } from '../modules/tokenization/TokenService';
import { ConsentService } from '../modules/consent/ConsentService';
import { SchemaService } from '../modules/schema/SchemaService';
import { RecordService } from '../modules/record/RecordService';
import { authMiddleware } from '../middlewares/auth.middleware';
import { apiFirewall } from '../middlewares/firewall.middleware';
import { FirewallService } from '../modules/firewall/FirewallService';
import { KmsService } from '../modules/kms/KmsService';
import crypto from 'crypto';

export const router = Router();

// ==========================================
// 🛡️ MODO FIREWALL CRIPTOGRÁFICO PARA APIs
// Estas rotas usam JWT rigoroso e Assinatura Híbrida em vez de API Key
// ==========================================

router.post('/firewall/protected-resource', apiFirewall, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({
            message: "Acesso concedido pelo Firewall!",
            status: "Blindado: Nonce, Timestamp, JWT e Assinatura Validados",
            payload_recebido: req.body
        });
    } catch (e) { next(e); }
});

// ==========================================
// APLICANDO API KEY PARA RESTANTE DAS ROTAS
// ==========================================
router.use(authMiddleware);

router.post('/firewall/issue-jwt', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await FirewallService.issueToken(req.tenantId!);
        res.json(result);
    } catch (e) { next(e); }
});

router.post('/firewall/demo-sign', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { body_payload, nonce, timestamp } = req.body;
        const { hmacSecret } = await KeyManager.getActiveProvider(req.tenantId!);
        
        const payloadToSign = (body_payload && Object.keys(body_payload).length > 0 ? JSON.stringify(body_payload) : '') + nonce + timestamp;
        const signature = crypto.createHmac('sha3-512', Buffer.from(hmacSecret, 'hex')).update(payloadToSign).digest('hex');
        
        res.json({ signature });
    } catch (e) { next(e); }
});

// ==========================================
// 🔑 MODO KMS AS A SERVICE (Cloud HSM Virtual)
// ==========================================

router.post('/kms/generate-data-key', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await KmsService.generateDataKey(req.tenantId!);
        res.json(result);
    } catch (e) { next(e); }
});

router.post('/kms/encrypt', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({ plaintext: z.string().min(1) });
        const { plaintext } = schema.parse(req.body);
        const ciphertextBlob = await KmsService.encryptData(req.tenantId!, plaintext);
        res.json({ ciphertext_blob: ciphertextBlob });
    } catch (e) { next(e); }
});

router.post('/kms/decrypt', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({ ciphertext_blob: z.string().min(1) });
        const { ciphertext_blob } = schema.parse(req.body);
        const plaintext = await KmsService.decryptData(req.tenantId!, ciphertext_blob);
        res.json({ plaintext });
    } catch (e) { next(e); }
});

router.post('/kms/export-backup', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({ 
            shares: z.number().min(2).max(10).default(3), 
            threshold: z.number().min(2).max(10).default(2) 
        });
        const { shares, threshold } = schema.parse(req.body);
        const result = await KmsService.generateShamirBackup(req.tenantId!, shares, threshold);
        res.json(result);
    } catch (e) { next(e); }
});

// ==========================================
// MODO API BLINDADA & CONFIGURAÇÕES (Data at Rest)
// ==========================================
router.post('/keys/rotate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const newVersion = await KeyManager.rotateKeys(req.tenantId!);
        res.json({ message: "Chaves rotacionadas com sucesso.", version: newVersion });
    } catch (e) { next(e); }
});

router.post('/secure-schema', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            name: z.string(),
            fields: z.record(z.enum(['token', 'encrypt', 'token+encrypt', 'password']))
        });
        const { name, fields } = schema.parse(req.body);
        const result = await SchemaService.createSchema(req.tenantId!, name, fields);
        res.json({ message: "Schema registrado.", schema: result.name });
    } catch (e) { next(e); }
});

router.post('/secure-record', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            schema_name: z.string(),
            data: z.record(z.any())
        });
        const { schema_name, data } = schema.parse(req.body);
        const result = await RecordService.processRecord(req.tenantId!, schema_name, data);
        res.json(result);
    } catch (e) { next(e); }
});

router.post('/verify-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            password_raw: z.string(),
            password_hash: z.string()
        });
        const { password_raw, password_hash } = schema.parse(req.body);
        const isValid = await RecordService.verifyPassword(password_raw, password_hash);
        res.json({ valid: isValid });
    } catch (e) { next(e); }
});

router.post('/tokenize', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({ value: z.string().min(1), type: z.string().optional() });
        const { value, type } = schema.parse(req.body);
        const token = await TokenService.tokenize(req.tenantId!, value, type);
        res.json({ token });
    } catch (e) { next(e); }
});

router.post('/consent', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            user_token: z.string(),
            policy_text: z.string(),
            policy_version: z.string()
        });
        const data = schema.parse(req.body);
        const result = await ConsentService.recordConsent(req.tenantId!, data.user_token, data.policy_text, data.policy_version);
        res.json(result);
    } catch (e) { next(e); }
});

router.get('/consent/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = z.string().uuid().parse(req.params.id);
        const isValid = await ConsentService.verifyConsent(req.tenantId!, id);
        res.json({ id, verified: isValid, status: "Secure" });
    } catch (e) { next(e); }
});