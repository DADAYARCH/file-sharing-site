import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export function FileUploader() {
    return (
        <Paper
            elevation={3}
            sx={{ p: 4, textAlign: 'center', border: '2px dashed #ccc', cursor: 'pointer' }}
        >
            <Typography variant="h6">Перетащите файл сюда или нажмите</Typography>
        </Paper>
    );
}
