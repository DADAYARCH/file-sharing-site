let keyPromise: Promise<CryptoKey> | null = null;
async function getKey(): Promise<CryptoKey> {
    if (!keyPromise) {
        keyPromise = crypto.subtle.generateKey(
            { name: 'AES-GCM', length: 256 },
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

    let b64 = '';
    for (const byte of combined) b64 += String.fromCharCode(byte);
    return btoa(b64);
}

export async function decryptData(token: string): Promise<string> {
    const key = await getKey();
    const bin = atob(token);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const iv = arr.slice(0, 12);
    const data = arr.slice(12);
    const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );
    return new TextDecoder().decode(plainBuf);
}
