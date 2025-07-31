import { webcrypto } from 'crypto'
const subtle = webcrypto.subtle

let keyPromise = null
async function getKey() {
    if (!keyPromise) {
        keyPromise = subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        )
    }
    return keyPromise
}


export async function decryptLink(token) {
    const key = await getKey()

    const combined = Buffer.from(token, 'base64')
    const iv       = combined.slice(0, 12)
    const data     = combined.slice(12)

    const plainBuf = await subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    )

    const json = new TextDecoder().decode(plainBuf)
    return JSON.parse(json)
}
