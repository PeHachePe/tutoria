import { TestBed } from '@angular/core/testing';

import { CommonFailure } from './common-failure';

describe('CommonFailure', () => {
  function setup(hidden = false) {
    const fixture = TestBed.createComponent(CommonFailure);
    fixture.componentRef.setInput('call', 'isStrongPassword("abc12345")');
    fixture.componentRef.setInput('expected', 'false');
    fixture.componentRef.setInput('students', 4);
    fixture.componentRef.setInput('hidden', hidden);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, host, text: host.textContent?.replace(/\s+/g, ' ').trim() };
  }

  it('says how many fail which call and what it expects', () => {
    const { text } = setup();

    expect(text).toContain('Para explicar a todos');
    expect(text).toContain('4 alumnos fallan isStrongPassword("abc12345") espera false');
    expect(text).not.toContain('prueba oculta');
  });

  it('marks a hidden test', () => {
    expect(setup(true).text).toContain('false · prueba oculta');
  });

  it('shows who fails it', () => {
    const { fixture, host } = setup();
    const show = vi.fn();
    fixture.componentInstance.show.subscribe(show);
    const button = host.querySelector('button') as HTMLButtonElement;

    button.click();

    expect(button.getAttribute('aria-label')).toBe(
      'Ver quiénes fallan isStrongPassword("abc12345")',
    );
    expect(show).toHaveBeenCalledOnce();
  });
});
