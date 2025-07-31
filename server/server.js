import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

import {
    handleChunkUpload,
    getFileInfo,
    downloadFile,
} from './controllers/upload.js';
import { createLink, validateLink } from './controllers/link.js';
import { bundleDownload } from './controllers/bundle.js';

const app = express();
app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.post(
    '/api/upload-chunk',
    express.raw({ type: '*/*', limit: '10gb' }),
    handleChunkUpload
);

app.post('/api/link', createLink);
app.get('/api/link/:token', validateLink);

app.get('/api/files/:fileId', getFileInfo);
app.get('/api/files/:fileId/download', downloadFile);

app.get('/api/bundle/:token', bundleDownload);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`HTTP listening on ${PORT}`));
