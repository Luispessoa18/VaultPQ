import { Pool } from 'pg';
import { config } from '../config/env';

export const db = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database
});