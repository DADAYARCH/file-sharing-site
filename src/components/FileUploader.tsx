import React, { useState, useRef, useEffect, DragEvent } from 'react';
import {
    Box,
    Paper,
    Typography,
    LinearProgress,
    Button,
    Link,
    IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { toCanvas } from 'qrcode';
import { encryptLink } from '../services/linkService';

interface FileItem {
    id: string;
    name: string;
    size: number;
    progress: number;
    status: 'uploading' | 'done' | 'error';
    worker: Worker;
}

export function FileUploader() {
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const [downloadLink, setDownloadLink] = useState<string>();
    const inputRef = useRef<HTMLInputElement>(null);
    const qrCanvas = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        const w = new Worker(
            new URL('../workers/uploadWorker.ts', import.meta.url),
            { type: 'module' }
        );

        w.onmessage = ({ data }) => {
            setFileList(prev =>
                prev.map(item => {
                    if (item.id !== data.fileId) {
                        return item;
                    }

                    if ((data as any).error) {
                        return { ...item, status: 'error' };
                    }

                    if (data.done) {
                        return { ...item, progress: 100, status: 'done' };
                    }

                    if (
                        typeof data.loaded === 'number' &&
                        typeof data.total === 'number'
                    ) {
                        const pct = Math.round((data.loaded / data.total) * 100);
                        return { ...item, progress: pct };
                    }

                    return item;
                })
            );
        };

        return () => w.terminate();
    }, []);

    const handleFile = (file: File) => {
        const id = crypto.randomUUID();
        const worker = new Worker(
            new URL('../workers/uploadWorker.ts', import.meta.url),
            { type: 'module' }
        );

        worker.onmessage = ({ data }) => {
            setFileList(prev =>
                prev.map(item => {
                    if (item.id !== id) return item;
                    if ((data as any).error) {
                        return { ...item, status: 'error' };
                    }
                    if (data.done) {
                        return { ...item, progress: 100, status: 'done' };
                    }
                    if (
                        typeof data.loaded === 'number' &&
                        typeof data.total === 'number'
                    ) {
                        const pct = Math.round((data.loaded / data.total) * 100);
                        return { ...item, progress: pct };
                    }
                    return item;
                })
            );
        };

        setFileList(prev => [
            ...prev,
            {
                id,
                name: file.name,
                size: file.size,
                progress: 0,
                status: 'uploading',
                worker,
            },
        ]);

        worker.postMessage({ file, chunkSize: 1024 * 1024, fileId: id });
        setDownloadLink(undefined);
    };

    const onDragOver = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };

    useEffect(() => {
        if (
            fileList.length > 0 &&
            fileList.every(f => f.status === 'done')
        ) {
            (async () => {
                const token = await encryptLink({
                    fileIds: fileList.map(f => f.id),
                    expiresAt: Date.now() + 24 * 3600 * 1000,
                });
                const encoded = encodeURIComponent(token);
                const link = `/download/${encoded}`;
                setDownloadLink(link);

                // рисуем QR
                if (qrCanvas.current) {
                    const url = window.location.origin + link;
                    await toCanvas(qrCanvas.current, url, {
                        errorCorrectionLevel: 'H',
                        width: 200,
                    }).catch(console.error);
                }
            })();
        }
    }, [fileList]);

    const cancelUpload = (id: string) => {
        setFileList(prev =>
            prev.filter(item => {
                if (item.id === id) {
                    item.worker.terminate();
                    return false;
                }
                return true;
            })
        );
        setDownloadLink(undefined);
    };
    const removeFile = (id: string) => {
        setFileList(prev => prev.filter(item => item.id !== id));
        setDownloadLink(undefined);
    };

    const copyLink = () => {
        if (downloadLink) {
            navigator.clipboard.writeText(window.location.origin + downloadLink);
        }
    };

    const fmtSize = (bytes: number) =>
        bytes < 1024
            ? `${bytes} B`
            : bytes < 1024 * 1024
                ? `${(bytes / 1024).toFixed(1)} KB`
                : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
            <Paper
                elevation={isDragging ? 8 : 3}
                sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '2px dashed',
                    borderColor: isDragging ? 'primary.main' : '#ccc',
                    cursor: 'pointer',
                    transition: '0.2s',
                }}
                onClick={() => inputRef.current?.click()}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <input
                    type="file"
                    ref={inputRef}
                    style={{ display: 'none' }}
                    onChange={e => e.target.files && handleFile(e.target.files[0])}
                />
                <Typography variant="h6">
                    Перетащите файл сюда или нажмите
                </Typography>
            </Paper>

            {fileList.length > 0 && (
                <Box sx={{ mt: 3, textAlign: 'left' }}>
                    <Typography variant="subtitle1">Файлы:</Typography>
                    {fileList.map(item => (
                        <Box
                            key={item.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                mt: 1,
                            }}
                        >
                            <Box sx={{ flex: 1, mr: 2 }}>
                                <Typography>
                                    {item.name} ({fmtSize(item.size)})
                                </Typography>
                                {item.status === 'uploading' && (
                                    <>
                                        <LinearProgress
                                            variant="determinate"
                                            value={isNaN(item.progress) ? 0 : item.progress}
                                            sx={{ mt: 0.5 }}
                                        />
                                        <Typography variant="caption">
                                            {isNaN(item.progress)
                                                ? '0%'
                                                : `${item.progress}%`}
                                        </Typography>
                                    </>
                                )}
                                {item.status === 'error' && (
                                    <Typography color="error" variant="caption">
                                        Ошибка загрузки
                                    </Typography>
                                )}
                            </Box>

                            {item.status === 'uploading' ? (
                                <Button
                                    size="small"
                                    color="error"
                                    onClick={() => cancelUpload(item.id)}
                                >
                                    Отменить
                                </Button>
                            ) : (
                                <IconButton
                                    size="small"
                                    onClick={() => removeFile(item.id)}
                                    sx={{ color: '#fff' }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    ))}
                </Box>
            )}

            {downloadLink && (
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                    <Button variant="outlined" onClick={copyLink}>
                        Копировать ссылку
                    </Button>
                    <Link
                        href={downloadLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ml: 2 }}
                    >
                        Скачать ({fileList.length}{' '}
                        {fileList.length > 1 ? 'файлов' : 'файл'})
                    </Link>
                    <Box sx={{ mt: 2 }}>
                        <canvas ref={qrCanvas} width={200} height={200} />
                    </Box>
                </Box>
            )}
        </Box>
    );
}
