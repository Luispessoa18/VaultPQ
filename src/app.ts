import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { router } from './routes';
import { authRouter } from './routes/auth';
import { portalRouter } from './routes/portal';
import { errorMiddleware } from './middlewares/error.middleware';
import { metricsMiddleware } from './middlewares/metrics.middleware';
import { swaggerHtml } from './docs/swagger';
import { adminHtml } from './docs/adminDashboard';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: (req) => {
        const ip = req.ip || '127.0.0.1';
        const auth = (req.headers['x-api-key'] || req.headers['authorization'] || '').toString();
        return crypto.createHash('sha256').update(`${ip}-${auth}`).digest('hex');
    },
    message: { error: 'Too many requests - Bloqueado pelo Firewall' }
});
app.use(limiter);

app.use(metricsMiddleware);

app.get('/admin-panel', (req, res) => { res.send(adminHtml); });
app.get('/docs', (req, res) => { res.send(swaggerHtml); });

app.use('/auth', authRouter);
app.use('/portal', portalRouter);
app.use('/', router);

app.use(errorMiddleware);

export { app };