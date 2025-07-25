import { render, screen } from '@testing-library/react';
import { FileUploader } from './FileUploader';
import '@testing-library/jest-dom';

test('renders drag-and-drop area', () => {
    render(<FileUploader />);
    expect(screen.getByText(/Перетащите файл сюда/i)).toBeInTheDocument();
});
