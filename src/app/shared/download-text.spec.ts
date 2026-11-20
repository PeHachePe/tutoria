import { downloadCsv } from './download-text';

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the text with its name through a link to it, and lets it go after', async () => {
    const createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:roster';
    });
    let saved: Blob | undefined;
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    downloadCsv(document, '1.º DAW A 2026-27.csv', 'Nombre;Correo\r\n');

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe('1.º DAW A 2026-27.csv');
    expect(link.href).toBe('blob:roster');
    expect(saved?.type).toBe('text/csv;charset=utf-8');
    // The byte order mark is three bytes in UTF-8
    expect(saved?.size).toBe(3 + 'Nombre;Correo\r\n'.length);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:roster');
    vi.unstubAllGlobals();
  });
});
