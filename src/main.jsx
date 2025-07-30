import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import { DownloadPage } from './pages/DownloadPage'
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material'

const darkTheme = createTheme({ palette: { mode: 'dark' } })

ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/download/:token" element={<DownloadPage />} />
            </Routes>
        </BrowserRouter>
    </ThemeProvider>
)
