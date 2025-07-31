import { createLink, validateLink, LinkPayload } from '../services/linkService';

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.resetAllMocks();
});

test('linkService: roundtrip payload (мокированный backend)', async () => {
    const payload: LinkPayload = {
        fileIds: ['abc123', 'def456'],
        expiresAt: Date.now() + 3600_000,
    };

    const fakeToken = 'FAKE_TOKEN_123';

    (global.fetch as jest.Mock)
        .mockImplementationOnce((_url: string, init: any) => {
            expect(init.method).toBe('POST');
            expect(init.headers['Content-Type']).toBe('application/json');
            expect(JSON.parse(init.body)).toEqual(payload);
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ token: fakeToken }),
            });
        })
        .mockImplementationOnce((url: string) => {
            expect(url).toContain(encodeURIComponent(fakeToken));
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve(payload),
            });
        });

    const token = await createLink(payload);
    expect(token).toBe(fakeToken);

    const result = await validateLink(token);
    expect(result).toEqual(payload);
}, 10000);
