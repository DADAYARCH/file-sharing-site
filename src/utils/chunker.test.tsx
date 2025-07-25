import { getChunks } from './chunker';

test('splits fileSize into correct offsets', () => {
    const chunks = getChunks(5_000_000, 2_000_000);
    expect(chunks).toEqual([
        { start: 0,        end: 2_000_000 },
        { start: 2_000_000, end: 4_000_000 },
        { start: 4_000_000, end: 5_000_000 },
    ]);
});
