const RAW_KEY_B64 = 'z0cC+7hb2KxG5a1vXYHn3YiQEoDkT4gFNPQx7q9OVQ4=';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') {
        const buf = Buffer.from(base64, 'base64');
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } else {
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            arr[i] = bin.charCodeAt(i);
        }
        return arr.buffer;
    }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    if (typeof btoa === 'function') {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        return btoa(binary);
    } else {
        return Buffer.from(buffer).toString('base64');
    }
}

let keyPromise: Promise<CryptoKey> | null = null;
async function getKey(): Promise<CryptoKey> {
    if (!keyPromise) {
        const raw = base64ToArrayBuffer(RAW_KEY_B64);
        keyPromise = crypto.subtle.importKey(
            'raw',
            raw,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }
    return keyPromise;
}

export async function encryptData(plain: string): Promise<string> {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(plain);
    const cipher = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );

    const combined = new Uint8Array(iv.byteLength + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.byteLength);

    return arrayBufferToBase64(combined.buffer);
}

export async function decryptData(token: string): Promise<string> {
    const key = await getKey();
    let arr: Uint8Array;
    if (typeof atob === 'function') {
        const bin = atob(token);
        arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    } else {
        arr = new Uint8Array(Buffer.from(token, 'base64'));
    }

    const iv = arr.slice(0, 12);
    const data = arr.slice(12);
    const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );
    return new TextDecoder().decode(plainBuf);
}
