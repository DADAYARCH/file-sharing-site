import { encryptLink, decryptLink, LinkPayload } from '../services/linkService';

test('linkService: roundtrip payload', async () => {
    const payload: LinkPayload = {
        fileIds: ['abc123', 'def456'],
        expiresAt: Date.now() + 3600_000
    };
    const token = await encryptLink(payload);
    const result = await decryptLink(token);
    expect(result.fileIds).toEqual(payload.fileIds);
    expect(result.expiresAt).toBe(payload.expiresAt);
}, 10000);