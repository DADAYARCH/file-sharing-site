import '@testing-library/jest-dom';

class MockWorker {
    onmessage = () => {};
    postMessage(_data?: any) {}
    terminate() {}
}
// @ts-ignore
global.Worker = MockWorker;
