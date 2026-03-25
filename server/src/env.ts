import path from 'path';
import dotenv from 'dotenv';

// npm runs the server workspace with cwd `server/`, so default dotenv misses repo-root `.env`
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
