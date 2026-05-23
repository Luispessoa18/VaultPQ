import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: process.env.PORT || 3000,
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        user: process.env.DB_USER || 'vault_user',
        password: process.env.DB_PASS || 'vault_pass',
        database: process.env.DB_NAME || 'securevault'
    },
    masterKey: process.env.MASTER_ENCRYPTION_KEY || '',
    passwordPepper: process.env.PASSWORD_PEPPER || 'default_pepper_fallback',
    adminApiKey: process.env.ADMIN_API_KEY || 'admin_secret_123'
};

if (config.masterKey.length !== 64) {
    console.warn("CRITICAL: MASTER_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes).");
}