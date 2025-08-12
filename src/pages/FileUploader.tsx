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

interface PendingEntry {
    fileId: string;
    name: string;
    size: number;
    lastModified: number;
    chunkSize: number;
    totalChunks: number;
    nextIndex: number;
    startedAt: number;
}

type PendingUI = PendingEntry & { key: string };

const STORAGE_KEY = 'uploadHistory';
const PENDING_KEY = 'pendingUploads';

const TTL_PRESETS = [
    { label: '1 минута', ms: 60 * 1000 },
    { label: '1 час',    ms: 60 * 60 * 1000 },
    { label: '6 час',    ms: 6 * 60 * 60 * 1000 },
    { label: '1 день',  ms: 24 * 60 * 60 * 1000 },
    { label: '7 дней',   ms: 7  * 24 * 60 * 60 * 1000 },
];

const MAX_PARALLEL = 2;
const CHUNK_SIZE = 1024 * 1024;

const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

function pendingKeyFor(file: { name: string; size: number; lastModified: number }) {
    return `${file.name}|${file.size}|${file.lastModified}`;
}

function readPendingMap(): Record<string, PendingEntry> {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}
function writePendingMap(map: Record<string, PendingEntry>) {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(map));
    } catch {}
}

export function FileUploader() {
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

    const [pendingMap, setPendingMap] = useState<Record<string, PendingEntry>>({});
    const pendingList = Object.entries(pendingMap).map(([k, v]) => ({ key: k, ...v }));
    const [firstVisitAfterClose, setFirstVisitAfterClose] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const qrCanvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setHistory(JSON.parse(raw));
        } catch {}

        const rawPending = readPendingMap();
        setPendingMap(rawPending);

        const visited = sessionStorage.getItem('uploaderVisited');
        if (!visited && Object.keys(rawPending).length > 0) {
            setFirstVisitAfterClose(true);
        }

        sessionStorage.setItem('uploaderVisited', '1');

    }, []);


    useEffect(() => {
        const onOff = () => setOnline(navigator.onLine);
        window.addEventListener('online', onOff);
        window.addEventListener('offline', onOff);
        return () => {
            window.removeEventListener('online', onOff);
            window.removeEventListener('offline', onOff);
        };
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
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        const pKey = pendingKeyFor(file);
        const newPending: PendingEntry = {
            fileId: id,
            name: file.name,
            size: file.size,
            lastModified: file.lastModified,
            chunkSize: CHUNK_SIZE,
            totalChunks,
            nextIndex: 0,
            startedAt: Date.now(),
        };
        const map = { ...pendingMap, [pKey]: newPending };
        setPendingMap(map);
        writePendingMap(map);

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

            if (typeof data.index === 'number') {
                const map2 = readPendingMap();
                const e = map2[pKey];
                if (e) {
                    e.nextIndex = data.index + 1;
                    map2[pKey] = e;
                    writePendingMap(map2);
                    setPendingMap(map2);
                }
            }

            if (data.done) {
                const map2 = readPendingMap();
                delete map2[pKey];
                writePendingMap(map2);
                setPendingMap(map2);
            }
        };

        setFileList(prev => [
            ...prev,
            { id, name: file.name, size: file.size, progress: 0, status: 'uploading', worker: w },
        ]);

        w.postMessage({ file, chunkSize: CHUNK_SIZE, fileId: id, startIndex: 0 });
        setSpaLink(undefined);
        setZipLink(undefined);
        setCurrentIds([]);
    }

    function startUploadResume(file: File, entry: PendingEntry) {
        const { fileId, nextIndex, totalChunks, chunkSize } = entry;

        const w = new Worker(new URL('../workers/uploadWorker.ts', import.meta.url), { type: 'module' });

        w.onmessage = ({ data }) => {
            setFileList(prev =>
                prev.map(item =>
                    item.id !== fileId
                        ? item
                        : data.done
                            ? { ...item, progress: 100, status: 'done' }
                            : { ...item, progress: Math.round((data.loaded / data.total) * 100) }
                )
            );

            const key = pendingKeyFor({ name: file.name, size: file.size, lastModified: file.lastModified });
            if (typeof data.index === 'number') {
                const map2 = readPendingMap();
                const e = map2[key];
                if (e) {
                    e.nextIndex = data.index + 1;
                    map2[key] = e;
                    writePendingMap(map2);
                    setPendingMap(map2);
                }
            }
            if (data.done) {
                const map2 = readPendingMap();
                delete map2[key];
                writePendingMap(map2);
                setPendingMap(map2);
            }
        };

        const initialProgress = Math.floor((nextIndex / totalChunks) * 100);
        setFileList(prev => [
            ...prev,
            { id: fileId, name: file.name, size: file.size, progress: initialProgress, status: 'uploading', worker: w },
        ]);

        w.postMessage({ file, chunkSize: entry.chunkSize, fileId, startIndex: nextIndex });
        setSpaLink(undefined);
        setZipLink(undefined);
        setCurrentIds([]);
    }

    function handleFiles(files: FileList | File[]) {
        if (!online) return;
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

    const handleCopy = () => {
        if (!spaLink) return;
        const fullUrl = window.location.origin + spaLink;
        navigator.clipboard.writeText(fullUrl).then(() => setCopied(true));
    };

    const removeItem = (id: string) => {
        setFileList(prev => {
            const next = prev.filter(f => f.id !== id);
            if (next.length === 0) {
                setSpaLink(undefined);
                setZipLink(undefined);
                setCurrentIds([]);
            } else {
                const ids = next.filter(f => f.status === 'done').map(f => f.id);
                setCurrentIds(ids);
            }
            return next;
        });
        const updated = readPendingMap();
        const victimKey = Object.keys(updated).find(k => updated[k].fileId === id);
        if (victimKey) {
            delete updated[victimKey];
            writePendingMap(updated);
            setPendingMap(updated);
        }
    };

    const clearHistory = () =>{
        setHistory([]);
        localStorage.removeItem(STORAGE_KEY);
    };

async function resumePending(uiEntry: PendingUI) {
    const key = uiEntry.key;
    const entry = { ...uiEntry } as PendingEntry;
    try {
        if ('showOpenFilePicker' in window) {
            const [handle]: FileSystemFileHandle[] = await (window as any).showOpenFilePicker();
            const file = await handle.getFile();
            if (file.name === entry.name && file.size === entry.size && file.lastModified === entry.lastModified) {
                startUploadResume(file, entry);
            } else {
                alert('Выбранный файл не совпадает с исходным (имя/размер/дата).');
            }
        } else {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = () => {
                const f = input.files?.[0];
                if (!f) return;
                if (f.name === entry.name && f.size === entry.size && f.lastModified === entry.lastModified) {
                    startUploadResume(f, entry);
                } else {
                    alert('Выбранный файл не совпадает с исходным (имя/размер/дата).');
                }
            };
            input.click();
        }
        setFirstVisitAfterClose(false);
    } catch (e) {
        console.warn('Возобновление отклонено или не удалось:', e);
        alert('Не удалось открыть диалог выбора файла. Повторите попытку.');
    }
}

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

            {firstVisitAfterClose && pendingList.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1">Незавершённые загрузки:</Typography>
                    {pendingList.map(p => (
                        <Paper key={p.key} variant="outlined" sx={{ p: 2, mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ mr: 2, flex: 1 }}>
                                <Typography>{p.name} ({fmtSize(p.size)})</Typography>
                                <Typography variant="caption">Продолжить с чанка {p.nextIndex} из {p.totalChunks}</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button size="small" variant="contained" onClick={() => resumePending(p)}>Продолжить</Button>
                                <Button size="small" variant="text" onClick={() => {
                                    const m = { ...pendingMap };
                                    delete m[p.key];
                                    setPendingMap(m);
                                    writePendingMap(m);
                                }}>Удалить</Button>
                            </Box>
                        </Paper>
                    ))}
                </Box>
            )}

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
                            onClick={clearHistory}
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
