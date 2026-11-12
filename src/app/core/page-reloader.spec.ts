import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageReloader } from './page-reloader';

describe('PageReloader', () => {
  const reload = vi.fn();
  const assign = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { location: { reload, assign } } }],
    });
  });

  it('reloads the location of the document', () => {
    TestBed.inject(PageReloader).reload();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('loads the root from scratch, which leads to the home of the signed-in role', () => {
    TestBed.inject(PageReloader).openHome();

    expect(assign).toHaveBeenCalledWith('/');
  });

  it('loads a page from scratch', () => {
    TestBed.inject(PageReloader).open('/docente?grupo=1');

    expect(assign).toHaveBeenCalledWith('/docente?grupo=1');
  });
});
