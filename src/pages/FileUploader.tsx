import React, { useState, useRef, useEffect, DragEvent } from 'react';
import {
    Box,
    Paper,
    Typography,
    LinearProgress,
    Button,
    Link,
    IconButton,
    Snackbar,
    Tooltip,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FileCopyIcon from '@mui/icons-material/FileCopy';
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

interface HistoryEntry {
    id: string;
    timestamp: number;
    files: { name: string; size: number }[];
    fileIds: string[];
    spaLink: string;
    expiresAt?: number;
}

const STORAGE_KEY = 'uploadHistory';

const TTL_PRESETS = [
    { label: '1 минута', ms: 60 * 1000 },
    { label: '1 час',    ms: 60 * 60 * 1000 },
    { label: '6 час',    ms: 6 * 60 * 60 * 1000 },
    { label: '1 день',  ms: 24 * 60 * 60 * 1000 },
    { label: '7 дней',   ms: 7  * 24 * 60 * 60 * 1000 },
];

export function FileUploader() {
    const MAX_PARALLEL = 2;
    const [queue, setQueue] = useState<File[]>([]);
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const [spaLink, setSpaLink] = useState<string>();
    const [zipLink, setZipLink] = useState<string>();
    const [isDragging, setIsDragging] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [copied, setCopied] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [ttlMs, setTtlMs] = useState<number>(60 * 60 * 1000);

    const [currentIds, setCurrentIds] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const qrCanvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setHistory(JSON.parse(raw));
        } catch (e) {
            console.warn('Не удалось прочитать историю загрузок', e);
        }
    }, []);

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
        const w = new Worker(new URL('../workers/uploadWorker.ts', import.meta.url), { type: 'module' });

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
        setCurrentIds([]);
    }

    function handleFiles(files: FileList | File[]) {
        setQueue(q => [...q, ...Array.from(files)]);
    }

    async function generateLinks(ids: string[], ttl: number) {
        const expiresAt = Date.now() + ttl;
        const token = await createLink({ fileIds: ids, expiresAt });
        const enc = encodeURIComponent(token);
        const newSpa = `/download/${enc}`;
        const newZip = `/api/bundle/${enc}`;
        setSpaLink(newSpa);
        setZipLink(newZip);


        setHistory(prev => {
            const idx = prev.findIndex(e =>
                e.fileIds.length === ids.length && e.fileIds.every((v, i) => v === ids[i])
            );
            if (idx >= 0) {
                const next = prev.slice();
                next[idx] = { ...next[idx], spaLink: newSpa, expiresAt };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            } else {
                const filesMeta = fileList
                    .filter(f => ids.includes(f.id))
                    .map(f => ({ name: f.name, size: f.size }));
                const entry: HistoryEntry = {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    files: filesMeta,
                    fileIds: ids.slice(),
                    spaLink: newSpa,
                    expiresAt
                };
                const next = [entry, ...prev];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return next;
            }
        });
    }

    useEffect(() => {
        if (fileList.length > 0 && fileList.every(f => f.status === 'done')) {
            const ids = fileList.map(f => f.id);
            setCurrentIds(ids);
            generateLinks(ids, ttlMs).catch(console.error);
        }
    }, [fileList]);

    useEffect(() => {
        if (!spaLink) {
            if (qrCanvas.current) {
                const ctx = qrCanvas.current.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, qrCanvas.current.width, qrCanvas.current.height);
            }
            return;
        }
        const fullUrl = window.location.origin + spaLink;
        if (qrCanvas.current) {
            toCanvas(qrCanvas.current, fullUrl, { errorCorrectionLevel: 'H', width: 250 }).catch(console.error);
        }
    }, [spaLink]);

    useEffect(() => {
        const onOff = () => setOnline(navigator.onLine);
        window.addEventListener('online', onOff);
        window.addEventListener('offline', onOff);
        return () => {
            window.removeEventListener('online', onOff);
            window.removeEventListener('offline', onOff);
        };
    }, []);

    const fmtSize = (b: number) =>
        b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

    const handleCopy = () => {
        if (!spaLink) return;
        const fullUrl = window.location.origin + spaLink;
        navigator.clipboard.writeText(fullUrl).then(() => setCopied(true));
    };

    const removeItem = (id: string) => {
        setFileList(prev =>{
            const next = prev.filter(f => f.id !== id);
            if (next.length === 0){
                setSpaLink(undefined);
                setZipLink(undefined);
                setCurrentIds([]);
            } else {
                const ids = next.filter(f => f.status === 'done').map(f => f.id);
                setCurrentIds(ids);
            }
            return next;
        });
    };

    const clearHistory = () =>{
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
            <Paper
                elevation={isDragging ? 8 : 3}
                sx={{p: 4, textAlign: 'center', border: '2px dashed', borderColor: isDragging ? 'primary.main' : '#ccc', borderRadius: 2, cursor: 'pointer'}}
                onClick={online ? () => inputRef.current?.click() : undefined}
                onDragOver={(e: DragEvent) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (!online) return;
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
                <Typography variant="h6">{online ? 'Перетащите файлы сюда или нажмите' : 'Вы офлайн — загрузка отключена'}</Typography>
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
                                {(item.status === 'uploading' || item.progress === 100) && (
                                    <>
                                        <LinearProgress variant="determinate" value={item.progress} sx={{ mt: 0.5 }} />
                                        <Typography variant="caption">{item.progress}%</Typography>
                                    </>
                                )}
                            </Box>

                            {item.status === 'uploading' ? (
                                <Button size="small" color="error" onClick={() => {
                                    item.worker.terminate();
                                    removeItem(item.id);
                                }}>
                                    Отменить
                                </Button>
                            ) : (
                                <IconButton size="small" onClick={() =>
                                    removeItem(item.id)
                                }>
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Box>
                    ))}
                </Box>
            )}

            {spaLink && zipLink && (
                <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Typography variant="subtitle1">Поделитесь этой ссылкой для скачивания</Typography>

                    <Box sx={{
                        display: 'inline-flex', alignItems: 'center', border: 1, borderColor: 'grey.400',
                        borderRadius: 2, p: 1, overflow: 'hidden', maxWidth: 320, mx: 'auto'
                    }}>
                        <Link href={spaLink} target="_blank" underline="none"
                                sx={{mr: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                              {window.location.origin + spaLink}
                        </Link>
                        <Tooltip title="Копировать в буфер">
                            <IconButton onClick={handleCopy} size="small">
                                <FileCopyIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <FormControl size="small">
                            <InputLabel id="ttl-label">Срок жизни</InputLabel>
                            <Select
                                labelId="ttl-label"
                                label="Срок жизни"
                                value={ttlMs}
                                onChange={(e) => setTtlMs(Number(e.target.value))}
                                sx={{ minWidth: 160 }}
                            >
                                {TTL_PRESETS.map(p => (
                                    <MenuItem key={p.ms} value={p.ms}>{p.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            variant="outlined"
                            onClick={() => currentIds.length && generateLinks(currentIds, ttlMs)}
                            disabled={currentIds.length === 0}
                        >
                            Перегенерировать ссылку
                        </Button>
                    </Box>

                    <canvas ref={qrCanvas} width={250} height={250} />

                    <Snackbar
                        open={copied}
                        autoHideDuration={1500}
                        onClose={() => setCopied(false)}
                        message="Ссылка скопирована"
                    />
                </Box>
            )}

            {history.length > 0 && (
                <>
                    <Divider sx={{ my: 4 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h6" gutterBottom>История загрузок:</Typography>
                        <Button
                            onClick={() => { setHistory([]); localStorage.removeItem(STORAGE_KEY); }}
                            variant="text" size="small"
                            sx={{ textTransform: 'none', color: 'text.secondary', fontSize: '0.875rem',
                                '&:hover': { background: 'transparent', color: 'text.primary' } }}
                        >
                            Очистить
                        </Button>
                    </Box>
                    {history.map(entry => (
                        <Paper key={entry.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="caption" color="textSecondary">
                                {new Date(entry.timestamp).toLocaleString()}
                                {entry.expiresAt && ` • действует до ${new Date(entry.expiresAt).toLocaleString()}`}
                            </Typography>
                            <Box sx={{ mt: 1 }}>
                                {entry.files.map((f, i) => (
                                    <Typography key={i} variant="body2">
                                        • {f.name} ({fmtSize(f.size)})
                                    </Typography>
                                ))}
                            </Box>
                            <Box sx={{ mt: 1 }}>
                                <Link href={entry.spaLink} target="_blank" underline="hover">
                                    Скачать файлы
                                </Link>
                            </Box>
                        </Paper>
                    ))}
                </>
            )}
        </Box>
    );
}
