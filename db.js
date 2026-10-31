import pg from 'pg'; import fs from 'node:fs/promises'; import {fileURLToPath} from 'node:url'; import path from 'node:path';
const {Pool}=pg;
export const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes('localhost')?false:{rejectUnauthorized:false},max:10});
export async function initDb(){const here=path.dirname(fileURLToPath(import.meta.url));await pool.query(await fs.readFile(path.join(here,'../db/schema.sql'),'utf8'));}
