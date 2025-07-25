import React, { useState, useRef, useEffect } from 'react';
import { Paper, Typography, LinearProgress } from '@mui/material';

export function FileUploader() {
    const [progress, setProgress] = useState(0);
    const [fileId] = useState(() => crypto.randomUUID());
    const inputRef = useRef<HTMLInputElement>(null);
    const [worker, setWorker] = useState<Worker>();

    useEffect(() => {
        const w = new Worker(
            new URL('../workers/uploadWorker.ts', import.meta.url),
            { type: 'module' }
        );

        w.onmessage = ({ data }) => {
            if (data.done) {
                setProgress(100);
            } else {
                const percent = Math.round((data.loaded / data.total) * 100);
                setProgress(percent);
            }
        };

        setWorker(w);
        return () => w.terminate();
    }, []);

    const handleFile = (file: File) => {
        const CHUNK_SIZE = 1024 * 1024; // 1 МБ
        setProgress(0);
        worker?.postMessage({ file, chunkSize: CHUNK_SIZE, fileId });
    };

    return (
        <Paper
            elevation={3}
            sx={{ p: 4, textAlign: 'center', border: '2px dashed #ccc', cursor: 'pointer' }}
            onClick={() => inputRef.current?.click()}
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

            {progress > 0 && (
                <>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ mt: 2 }}
                    />
                    <Typography sx={{ mt: 1 }}>
                        {progress}%
                    </Typography>
                </>
            )}
        </Paper>
    );
}
