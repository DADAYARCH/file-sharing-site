import { render, screen } from '@testing-library/react';
import { FileUploader } from './FileUploader';

test('renders drag-and-drop area', () => {
    render(<FileUploader />);
    expect(screen.getByText(/Перетащите файл сюда/i)).toBeInTheDocument();
});
