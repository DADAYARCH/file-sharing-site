import path from 'path'
import fs from 'fs'
import archiver from 'archiver'
import { decryptLink } from '../utils/linkService.js'

const UPLOAD_DIR = path.resolve(process.cwd(), 'server', 'uploads')

export async function bundleDownload(req, res) {
    const { token } = req.params
    let payload
    try {
        payload = await decryptLink(decodeURIComponent(token))
    } catch (e) {
        return res.status(400).send('Invalid or expired token')
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader(
        'Content-Disposition',
        'attachment; filename="files.zip"'
    )

    const archive = archiver('zip', { zlib: { level: 9 } })
    archive.on('error', err => res.status(500).send({ error: err.message }))
    archive.pipe(res)

    for (const fileId of payload.fileIds) {
        const filePath = path.join(UPLOAD_DIR, fileId)
        if (fs.existsSync(filePath)) {

            archive.file(filePath, { name: fileId })
        }
    }

    archive.finalize()
}
