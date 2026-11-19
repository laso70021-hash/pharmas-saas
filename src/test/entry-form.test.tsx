import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntryForm } from '@/components/workspace/EntryForm';
import { blankEntry } from '@/lib/entry-model';

afterEach(cleanup);

function fillRequiredProductFields() {
  fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Paracetamol' } });
  fireEvent.change(screen.getByLabelText('SKU'), { target: { value: 'PCM500' } });
  fireEvent.change(screen.getByLabelText('Unit of measurement'), { target: { value: 'tablet' } });
  fireEvent.change(screen.getByLabelText('Selling price (TZS)'), { target: { value: '100' } });
}

describe('product image form', () => {
  it('requires and saves an image when adding a product', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EntryForm module="products" references={{}} onClose={() => {}} onSave={onSave} />);

    const input = screen.getByLabelText(/Product image/);
    expect(input).toBeRequired();
    fillRequiredProductFields();
    const photo = new File(['photo'], 'paracetamol.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [photo] } });
    expect((input as HTMLInputElement).files?.[0]).toBe(photo);
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Paracetamol', sku: 'PCM500' }), photo));
  });

  it('shows the current image and accepts a replacement when editing', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initial = { ...blankEntry('products'), id: 'product-1', name: 'Paracetamol', sku: 'PCM500', unit_of_measurement: 'tablet', selling_price: '100' };
    render(<EntryForm module="products" initial={initial} imageSrc="https://example.test/current.jpg" references={{}} onClose={() => {}} onSave={onSave} />);

    expect(screen.getByAltText('Current product')).toHaveAttribute('src', 'https://example.test/current.jpg');
    const input = screen.getByLabelText(/Change product image/);
    expect(input).not.toBeRequired();
    const photo = new File(['new photo'], 'replacement.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [photo] } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'product-1' }), photo));
  });
});
