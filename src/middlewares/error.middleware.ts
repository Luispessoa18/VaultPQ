import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
    logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).json({
        error: "Internal Server Error",
        message: err.message || "Ocorreu um erro no servidor."
    });
}