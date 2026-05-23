import { app } from './app';
import { config } from './infra/config/env';
import { logger } from './utils/logger';
import { db } from './infra/db';
import { TenantService } from './modules/tenant/TenantService';

async function bootstrap() {
    try {
        await db.query('SELECT 1');
        logger.info("Database connected.");

        // Aplicando Migrações Automáticas para a Estrutura de Autenticação 2FA (TOTP)
        await db.query(`
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS totp_secret TEXT;
            ALTER TABLE tenants ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
            
            CREATE TABLE IF NOT EXISTS sys_admins (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(50) UNIQUE NOT NULL,
                totp_secret TEXT,
                totp_enabled BOOLEAN DEFAULT FALSE
            );
            
            INSERT INTO sys_admins (username) VALUES ('admin') ON CONFLICT DO NOTHING;
        `);

        // Seeder inicial do SaaS: Cria um cliente padrão para o Swagger funcionar de imediato
        const tenantsCount = await db.query('SELECT count(*) FROM tenants');
        if (parseInt(tenantsCount.rows[0].count) === 0) {
            logger.info("Banco vazio. Inicializando o Tenant Padrão para testes...");
            await TenantService.createTenant('Demonstração SaaS', 'admin@saas.com', 'sk_test_123456789');
            logger.info("Tenant Padrão criado! Chave de acesso: sk_test_123456789");
        }

        app.listen(config.port, () => {
            logger.info(`SecureVault PQ API running on port ${config.port}`);
            logger.info(`> Swagger (Documentação): http://localhost:${config.port}/docs`);
            logger.info(`> Portal SaaS (Admin/Tenant): http://localhost:${config.port}/admin-panel`);
        });
    } catch (e) {
        logger.error("Failed to start server", e);
        process.exit(1);
    }
}

bootstrap();