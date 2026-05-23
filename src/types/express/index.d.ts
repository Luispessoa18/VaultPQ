import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
            user?: { role: string; id?: string };
        }
    }
}