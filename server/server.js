import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import https from 'https';

import { handleChunkUpload } from './controllers/upload.js';
import filesRouter from './routes/files.js';

const app = express();
const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());

app.post(
    '/api/upload-chunk',
    express.raw({ type: '*/*', limit: '10gb' }),
    handleChunkUpload
);

app.use('/api', express.json(), express.urlencoded({ extended: true }), filesRouter);

const PORT = process.env.PORT || 3001;
if (process.env.SSL_KEY && process.env.SSL_CERT) {
    const options = {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
    };
    https.createServer(options, app).listen(PORT, () =>
        console.log(`HTTPS listening on ${PORT}`)
    );
} else {
    app.listen(PORT, '0.0.0.0', () =>
        console.log(`HTTP listening on 0.0.0.0:${PORT}`)
    );
}
