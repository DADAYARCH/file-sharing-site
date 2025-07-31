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
import { createLink } from '../services/linkService';

interface FileItem {
    id: string;
    name: string;
    size: number;
    progress: number;
    status: 'uploading' | 'done';
    worker: Worker;
}

export function FileUploader() {
    const MAX_PARALLEL = 2;
    const [queue, setQueue] = useState<File[]>([]);
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const [spaLink, setSpaLink] = useState<string>();
    const [zipLink, setZipLink] = useState<string>();
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const qrCanvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const uploading = fileList.filter(f => f.status === 'uploading').length;
        if (uploading < MAX_PARALLEL && queue.length > 0) {
            const [next, ...rest] = queue;
            setQueue(rest);
            startUpload(next);
        }
    }, [queue, fileList]);

    function startUpload(file: File) {
        const id = crypto.randomUUID();
        const w = new Worker(new URL('../workers/uploadWorker.ts', import.meta.url), {
            type: 'module',
        });
        w.onmessage = ({ data }) => {
            setFileList(prev =>
                prev.map(item =>
                    item.id !== id
                        ? item
                        : data.done
                            ? { ...item, progress: 100, status: 'done' }
                            : { ...item, progress: Math.round((data.loaded / data.total) * 100) }
                )
            );
        };

        setFileList(prev => [
            ...prev,
            { id, name: file.name, size: file.size, progress: 0, status: 'uploading', worker: w },
        ]);
        w.postMessage({ file, chunkSize: 1024 * 1024, fileId: id });
        setSpaLink(undefined);
        setZipLink(undefined);
    }

    function handleFiles(files: FileList | File[]) {
        setQueue(q => [...q, ...Array.from(files)]);
    }

    useEffect(() => {
        if (fileList.length > 0 && fileList.every(f => f.status === 'done')) {
            (async () => {
                const token = await createLink({
                    fileIds: fileList.map(f => f.id),
                    expiresAt: Date.now() + 24 * 3600 * 1000,
                });
                setSpaLink(`/download/${token}`);
                setZipLink(`/api/bundle/${token}`);

                if (qrCanvas.current) {
                    const full = window.location.origin + `/download/${token}`;
                    await toCanvas(qrCanvas.current, full, { errorCorrectionLevel: 'H', width: 200 });
                }
            })();
        }
    }, [fileList]);

    const fmtSize = (b: number) =>
        b < 1024
            ? `${b} B`
            : b < 1024 * 1024
                ? `${(b / 1024).toFixed(1)} KB`
                : `${(b / 1024 / 1024).toFixed(1)} MB`;

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
                }}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e: DragEvent) => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
                }}
            >
                <input
                    type="file"
                    multiple
                    ref={inputRef}
                    style={{ display: 'none' }}
                    onChange={e => e.target.files && handleFiles(e.target.files)}
                />
                <Typography variant="h6">Перетащите файлы сюда или нажмите</Typography>
            </Paper>

            {fileList.length > 0 && (
                <Box sx={{ mt: 3, textAlign: 'left' }}>
                    <Typography variant="subtitle1">Файлы:</Typography>
                    {fileList.map(item => (
                        <Box
                            key={item.id}
                            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}
                        >
                            <Box sx={{ flex: 1, mr: 2 }}>
                                <Typography>
                                    {item.name} ({fmtSize(item.size)})
                                </Typography>
                                {item.status === 'uploading' && (
                                    <>
                                        <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.5 }} />
                                        <Typography variant="caption">{item.progress}%</Typography>
                                    </>
                                )}
                            </Box>

                            {item.status === 'uploading' ? (
                                <Button size="small" color="error" onClick={() => {
                                    item.worker.terminate();
                                    setFileList(fl => fl.filter(f => f.id !== item.id));
                                }}>
                                    Отменить
                                </Button>
                            ) : (
                                <IconButton size="small" onClick={() => {
                                    setFileList(fl => fl.filter(f => f.id !== item.id));
                                }}>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    ))}
                </Box>
            )}

            {spaLink && zipLink && (
                <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Button variant="contained" href={spaLink}>
                            Перейти к странице скачивания
                        </Button>
                        <Button variant="outlined" href={zipLink} target="_blank" sx={{ ml: 2 }}>
                            Скачать всё в ZIP
                        </Button>
                    </Box>
                    <canvas ref={qrCanvas} width={200} height={200} />
                </Box>
            )}
        </Box>
    );
}
