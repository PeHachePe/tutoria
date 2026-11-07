import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageReloader } from './page-reloader';

describe('PageReloader', () => {
  it('reloads the location of the document', () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { location: { reload } } }],
    });

    TestBed.inject(PageReloader).reload();

    expect(reload).toHaveBeenCalledOnce();
  });
});
