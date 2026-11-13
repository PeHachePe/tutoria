import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FLASH_MS, FlashOnChange } from './flash-on-change';

@Component({
  imports: [FlashOnChange],
  template: `<p [appFlashOnChange]="value()">Fila</p>`,
})
class Host {
  readonly value = signal(1);
}

describe('FlashOnChange', () => {
  function setup(reducedMotion = false) {
    // jsdom has neither matchMedia nor the Web Animations API
    window.matchMedia = vi.fn(() => ({ matches: reducedMotion }) as MediaQueryList);
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate;
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, animate };
  }

  afterEach(() => {
    delete (window as Partial<Window>).matchMedia;
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  it('does not flash the first time, and flashes each time the value changes', () => {
    const { fixture, animate } = setup();
    expect(animate).not.toHaveBeenCalled();

    fixture.componentInstance.value.set(2);
    fixture.detectChanges();

    expect(animate).toHaveBeenCalledOnce();
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: FLASH_MS });
  });

  it('stays still for whoever asks for less motion', () => {
    const { fixture, animate } = setup(true);

    fixture.componentInstance.value.set(2);
    fixture.detectChanges();

    expect(animate).not.toHaveBeenCalled();
  });

  it('does nothing in a browser without the Web Animations API', () => {
    const { fixture } = setup();
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;

    fixture.componentInstance.value.set(2);

    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
