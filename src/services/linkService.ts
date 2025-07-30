import { encryptData, decryptData } from './cryptoService';

export interface LinkPayload {
    fileIds: string[];
    expiresAt: number;
}

export async function encryptLink(payload: LinkPayload): Promise<string> {
    const json = JSON.stringify(payload);
    return encryptData(json);
}

export async function decryptLink(token: string): Promise<LinkPayload> {
    const json = await decryptData(token);
    return JSON.parse(json) as LinkPayload;
}
