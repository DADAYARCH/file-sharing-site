import './App.css'
import React from 'react';
import { FileUploader } from './components/FileUploader';


function App() {
    return (
        <div className="App" style={{ maxWidth: 600, margin: '2rem auto' }}>
            <h1 style={{ textAlign: 'center' }}>File Sharer</h1>

            <FileUploader />

             <div className="card" style={{ marginTop: '2rem' }}>
      </div>
        </div>
    )
}

export default App
