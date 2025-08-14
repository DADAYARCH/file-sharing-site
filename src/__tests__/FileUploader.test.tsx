import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FileUploader } from '../pages/FileUploader';

const STORAGE_KEY = 'uploadHistory';

jest.mock('../workers/createUploadWorker', () => {
    let lastWorker: any;
    return {
        __esModule: true,
        createUploadWorker: jest.fn(() => {
            const w: any = {
                onmessage: null,
                postMessage: jest.fn(),
                terminate: jest.fn(),
                __emit(data: any) {
                    act(() => {
                        this.onmessage && this.onmessage({ data } as MessageEvent);
                    })
                },
            };
            lastWorker = w;
            return w as unknown as Worker;
        }),
        __getLastWorker: () => lastWorker,
    };
});

jest.mock('qrcode', () => ({ toCanvas: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../services/linkService', () => ({
    createLink: jest.fn().mockResolvedValue('FAKE_TOKEN'),
}));

const getMockWorker = () => {
    return require('../workers/createUploadWorker').__getLastWorker();
};

function makeFile(content: string, name = 'test.txt', lastModified = 111) {
    return new File([content], name, { type: 'text/plain', lastModified });
}

function seedHistory() {
    const history = [
        {
            id: 'h1',
            timestamp: 1710000000000,
            files: [{ name: 'a.txt', size: 1234 }],
            fileIds: ['f1'],
            spaLink: '/download/TOKEN1',
            expiresAt: 1710003600000,
        },
        {
            id: 'h2',
            timestamp: 1710001000000,
            files: [
                { name: 'b.bin', size: 2048 },
                { name: 'c.jpg', size: 4096 },
            ],
            fileIds: ['f2', 'f3'],
            spaLink: '/download/TOKEN2',
        },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

test('рендерит область дропа', () => {
    render(<FileUploader />);
    expect(
        screen.getByText(/Перетащите файлы сюда или нажмите|Вы офлайн — загрузка отключена/),
    ).toBeInTheDocument();
});

test('старт загрузки: создаётся воркер и шлётся postMessage', async () => {
    render(<FileUploader />);
    const fileInput = screen.getByTestId('upload-section')
    const file = makeFile('hello', 'a.txt', 222);

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
        const w = getMockWorker();
        expect(w).toBeTruthy();
        expect(w.postMessage).toHaveBeenCalledTimes(1);
    });
});

test('обновляет прогресс по сообщениям воркера и показывает "done"', async () => {
    render(<FileUploader />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const size = 1024 * 1024 * 2;
    const file = makeFile('x'.repeat(size), 'big.bin', 333);
    fireEvent.change(fileInput, { target: { files: [file] } });

    const w = await waitFor(() => getMockWorker());

    w.__emit({ loaded: size / 2, total: size, index: 0, done: false });
    await waitFor(() => {
        expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    w.__emit({ loaded: size, total: size, index: 1, done: true });

    await waitFor(() => {
        expect(screen.getByTestId('share-section')).toBeInTheDocument();
    });
});

test('копирование ссылки копирует в буфер', async () => {
    render(<FileUploader />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('ok', 'a.txt', 444);
    fireEvent.change(fileInput, { target: { files: [file] } });

    const w = await waitFor(() => getMockWorker());
    await act(async () => {
        w.__emit({ loaded: 2, total: 2, index: 0, done: true });
    });

    const copyBtn = await screen.findByTestId('copy-button');

    const absoluteUrl = (await screen.findByTestId('link-for-share') as HTMLAnchorElement).href;

    fireEvent.click(copyBtn);

    await waitFor(() => {
        expect((navigator.clipboard.writeText as jest.Mock)).toHaveBeenCalledWith(absoluteUrl);
    });

});

test('отображение истории загрузок и её очистка', async () => {
    seedHistory();

    render(<FileUploader />);

    const header = await screen.getByTestId('history-head')
    expect(header).toBeInTheDocument()

    expect(screen.getByText(/a\.txt/i)).toBeInTheDocument();
    expect(screen.getByText(/b\.bin/i)).toBeInTheDocument();
    expect(screen.getByText(/c\.jpg/i)).toBeInTheDocument();

    const clearBtn = screen.getByTestId('clear-btn');
    fireEvent.click(clearBtn);

    await waitFor(() => {
        expect(screen.queryByTestId('history-head')).not.toBeInTheDocument();
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
});


