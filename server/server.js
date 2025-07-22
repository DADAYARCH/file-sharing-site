import express from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import cors from 'cors';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
// raw-обработка любого контента (чанки)
app.use('/api/upload-chunk', express.raw({ type: '*/*', limit: '10gb' }));

// Приём чанка
app.post('/api/upload-chunk', (req, res) => {
    const { fileId, index, total } = req.query;
    if (!fileId || index == null || total == null) {
        return res.status(400).json({ error: 'Missing fileId, index or total' });
    }
    // Преобразуем параметры запроса в числа
    const idx = parseInt(String(index), 10);
    const tot = parseInt(String(total), 10);
    const chunkDir = path.join(UPLOAD_DIR, String(fileId));
    fs.mkdirSync(chunkDir, { recursive: true });

    const chunkPath = path.join(chunkDir, String(idx));
    fs.writeFileSync(chunkPath, req.body);

    // Если последний – собираем файл
    if (idx === tot - 1) {
        const finalPath = path.join(UPLOAD_DIR, String(fileId));
        const writeStream = fs.createWriteStream(finalPath);
        for (let i = 0; i < tot; i++) {
            const buf = fs.readFileSync(path.join(chunkDir, String(i)));
            writeStream.write(buf);
        }
        writeStream.end();
        fs.rmSync(chunkDir, { recursive: true, force: true });
    }

    return res.json({ status: 'ok', index: idx });
});

// Получение метаданных файла
app.get('/api/files/:fileId', (req, res) => {
    const { fileId } = req.params;
    const filePath = path.join(UPLOAD_DIR, fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }
    const stat = fs.statSync(filePath);
    return res.json({ size: stat.size, name: path.basename(filePath) });
});

// Загрузка файла
app.get('/api/files/:fileId/download', (req, res) => {
    const { fileId } = req.params;
    const filePath = path.join(UPLOAD_DIR, fileId);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Not found');
    }
    res.download(filePath);
});

// Настрока HTTPS
const PORT = process.env.PORT || 3001;
if (process.env.SSL_KEY && process.env.SSL_CERT) {
    const options = {
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT),
    };
    https.createServer(options, app).listen(PORT, () => {
        console.log(`HTTPS server listening on port ${PORT}`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`HTTP server listening on port ${PORT}`);
    });
}