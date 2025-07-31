export interface LinkPayload {
    fileIds: string[];
    expiresAt: number;
}

export async function createLink(payload: LinkPayload): Promise<string> {
    const res = await fetch('/api/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create link');
    const { token } = await res.json();
    return token;
}

export async function validateLink(token: string): Promise<LinkPayload> {
    const res = await fetch(`/api/link/${token}`);
    if (!res.ok) throw new Error('Invalid or expired token');
    const payload = await res.json();
    return payload as LinkPayload;
}
