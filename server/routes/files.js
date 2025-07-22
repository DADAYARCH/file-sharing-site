import { Router } from 'express';
import { handleChunkUpload, getFileInfo, downloadFile } from '../controllers/upload.js';

const router = new Router();
router.post('/upload-chunk', handleChunkUpload);
router.get('/files/:fileId', getFileInfo);
router.get('/files/:fileId/download', downloadFile);

export default router;
