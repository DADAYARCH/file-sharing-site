import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    CircularProgress,
    Link as MuiLink,
} from '@mui/material';
import QRCode from 'qrcode';
import { decryptLink, LinkPayload } from '../services/linkService';

interface FileMeta {
    name: string;
    size: number;
}

export function DownloadPage() {
    const { token } = useParams<{ token: string }>();
    const [payload, setPayload] = useState<LinkPayload>();
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [error, setError] = useState<string>();
    const qrCanvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!token) {
            setError('Отсутствует токен в URL')
            return
        }
        const raw = decodeURIComponent(token)
        decryptLink(raw)
            .then(p => setPayload(p))
            .catch(() => setError('Неверный или просроченный токен'))
    }, [token])

    useEffect(() => {
        if (!payload) return;
        Promise.all(
            payload.fileIds.map(id =>
                fetch(`/api/files/${id}`)
                    .then(res => {
                        if (!res.ok) throw new Error();
                        return res.json() as Promise<FileMeta>;
                    })
            )
        )
            .then(setFiles)
            .catch(() => setError('Ошибка при получении данных файлов'));
    }, [payload]);

    useEffect(() => {
        if (payload && qrCanvas.current) {
            const link = `/download/${encodeURIComponent(token!)}`;
            const fullUrl = window.location.origin + link;
            QRCode.toCanvas(qrCanvas.current, fullUrl, {
                errorCorrectionLevel: 'H',
                width: 200,
            }).catch(console.error);
        }
    }, [payload, token]);

    if (error) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
                <Button component={RouterLink} to="/">
                    На главную
                </Button>
            </Box>
        );
    }

    if (!payload || files.length < payload.fileIds.length) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const singleUrl = `/api/files/${payload.fileIds[0]}/download`;

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, textAlign: 'center' }}>
            <Typography variant="h5">Ваши файлы готовы к скачиванию</Typography>

            {files.length === 1 ? (
                <Box sx={{ mt: 2 }}>
                    <Typography>{files[0].name}</Typography>
                    <Typography variant="caption">
                        {Math.round(files[0].size / 1024)} KB
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                        <Button variant="contained" href={singleUrl}>
                            Скачать файл
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ mt: 2, textAlign: 'left' }}>
                    <Typography variant="subtitle1">Список файлов:</Typography>
                    {files.map((f, i) => (
                        <Box
                            key={i}
                            sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}
                        >
                            <Typography>{f.name}</Typography>
                            <Typography variant="caption">
                                {Math.round(f.size / 1024)} KB
                            </Typography>
                            <Button
                                size="small"
                                href={`/api/files/${payload.fileIds[i]}/download`}
                            >
                                Скачать
                            </Button>
                        </Box>
                    ))}
                </Box>
            )}

            <Box sx={{ mt: 4 }}>
                <canvas ref={qrCanvas} width={200} height={200} />
            </Box>
            <Box sx={{ mt: 2 }}>
                <Button
                    variant="outlined"
                    onClick={() =>
                        navigator.clipboard.writeText(window.location.href)
                    }
                >
                    Копировать ссылку
                </Button>
            </Box>
        </Box>
    );
}
