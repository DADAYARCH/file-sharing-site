import '@testing-library/jest-dom'
import { webcrypto } from 'crypto'

Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
})

import { TextEncoder, TextDecoder } from 'util'
Object.defineProperty(globalThis, 'TextEncoder', {
    value: TextEncoder,
    configurable: true,
})
Object.defineProperty(globalThis, 'TextDecoder', {
    value: TextDecoder,
    configurable: true,
})

Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
});

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
});

class MockWorker {
    onmessage = (_: any) => {}
    postMessage(_data?: any) {}
    terminate() {}
}
Object.defineProperty(globalThis, 'Worker', {
    value: MockWorker,
    configurable: true,
})
