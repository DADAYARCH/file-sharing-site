import { encryptData, decryptData } from '../services/cryptoService';

test('cryptoService: roundtrip encrypt/decrypt', async () => {
    const msg = 'Hello, 123! Тест';
    const token = await encryptData(msg);
    expect(typeof token).toBe('string');
    const out = await decryptData(token);
    expect(out).toBe(msg);
}, 10000);
