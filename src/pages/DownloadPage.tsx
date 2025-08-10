import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Typography,
    Button,
    CircularProgress
} from '@mui/material';
import { validateLink } from '../services/linkService';

interface FileMeta {
    name: string;
    size: number;
}

export function DownloadPage() {
    const { token } = useParams<{ token: string }>();
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [error, setError] = useState<string>();
    const [fileIds, setFileIds] = useState<string[]>([]);

    useEffect(() => {
        if (!token) {
            setError('Отсутствует токен в URL');
            return;
        }
        validateLink(token)
            .then(payload => {
                setFileIds(payload.fileIds);
            })
            .catch(() => {
                setError('Срок действия ссылки истёк или токен неверен');
            });
    }, [token]);

    useEffect(() => {
        if (fileIds.length === 0) return;
        Promise.all(
            fileIds.map(id =>
                fetch(`/api/files/${id}`)
                    .then(res => {
                        if (!res.ok) throw new Error();
                        return res.json() as Promise<FileMeta>;
                    })
            )
        )
            .then(setFiles)
            .catch(() => {
                setError('Не удалось получить информацию о файлах');
            });
    }, [fileIds]);

    if (error) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="error">{error}</Typography>
                <Button component={RouterLink} to="/">На главную</Button>
            </Box>
        );
    }
    if (!fileIds.length || files.length < fileIds.length) {
        return (
            <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    const bundleUrl = `/api/bundle/${encodeURIComponent(token as string)}`;

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
                        <Button
                            variant="contained"
                            href={`/api/files/${fileIds[0]}/download`}
                        >
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
                                href={`/api/files/${fileIds[i]}/download`}
                            >
                                Скачать
                            </Button>
                        </Box>
                    ))}
                </Box>
            )}

            <Box sx={{ mt: 4 }}>
                <Button variant="outlined" href={bundleUrl}>
                    Скачать всё в ZIP
                </Button>
            </Box>
        </Box>
    );
}
