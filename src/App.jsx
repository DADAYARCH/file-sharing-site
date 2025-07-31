import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { FileUploader } from './components/FileUploader'
import { DownloadPage } from './pages/DownloadPage'

export default function App() {
    return (
        <>
            <h1 style={{ textAlign: 'center' }}>File Sharer</h1>
            <Routes>
                <Route path="/" element={<FileUploader />} />
                <Route path="/download/:token" element={<DownloadPage />} />
            </Routes>
        </>
    )
}
