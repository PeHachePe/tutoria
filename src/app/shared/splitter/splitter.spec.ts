import { Component, signal } from '@angular/core';
import { fireEvent, render, screen } from '@testing-library/angular';

import { Splitter } from './splitter';

@Component({
  imports: [Splitter],
  template: `
    <div data-testid="container">
      <div id="pane"></div>
      <app-splitter
        label="Tamaño del enunciado"
        controls="pane"
        [(value)]="share"
        (changeEnd)="ended.push($event)"
      />
    </div>
  `,
})
class Host {
  readonly share = signal(45);
  readonly ended: number[] = [];
}

async function renderSplitter() {
  const { fixture } = await render(Host);
  const splitter = screen.getByRole('separator', { name: 'Tamaño del enunciado' });
  const container = screen.getByTestId('container');
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 100, 800, 400), // top 100, height 400
  );
  return { host: fixture.componentInstance, splitter, container, fixture };
}

/** jsdom has no PointerEvent: a mouse event with its name and position does the same here. */
function pointer(type: string, target: Element | Document, clientY = 0, button = 0): void {
  fireEvent(target, new MouseEvent(type, { bubbles: true, clientY, button }));
}

/** The same, along the width. */
function pointerX(type: string, target: Element | Document, clientX: number): void {
  fireEvent(target, new MouseEvent(type, { bubbles: true, clientX, button: 0 }));
}

@Component({
  imports: [Splitter],
  template: `
    <div data-testid="row">
      <div id="left"></div>
      <app-splitter
        orientation="vertical"
        label="Ancho del código"
        controls="left"
        [min]="50"
        [max]="80"
        [defaultValue]="70"
        [(value)]="share"
        (changeEnd)="ended.push($event)"
      />
    </div>
  `,
})
class RowHost {
  readonly share = signal(70);
  readonly ended: number[] = [];
}

describe('Splitter', () => {
  it('is a focusable separator that tells the share of the pane it controls', async () => {
    const { splitter } = await renderSplitter();

    expect(splitter.getAttribute('tabindex')).toBe('0');
    expect(splitter.getAttribute('aria-orientation')).toBe('horizontal');
    expect(splitter.getAttribute('aria-controls')).toBe('pane');
    expect(splitter.getAttribute('aria-valuenow')).toBe('45');
    expect(splitter.getAttribute('aria-valuemin')).toBe('15');
    expect(splitter.getAttribute('aria-valuemax')).toBe('70');
    // As the locale writes it: «45 %» in Spanish, with a no-break space
    expect(splitter.getAttribute('aria-valuetext')).toMatch(/^45\s%$/);
  });

  it('follows the pointer while dragged, within its limits, and reports where it ended', async () => {
    const { host, splitter, fixture } = await renderSplitter();

    pointer('pointerdown', splitter, 280);
    pointer('pointermove', document, 300); // 200 of 400 px: half
    expect(host.share()).toBe(50);
    expect(document.activeElement).toBe(splitter);

    pointer('pointermove', document, 480); // 95 %, above the maximum
    expect(host.share()).toBe(70);
    pointer('pointermove', document, 90); // above the container
    expect(host.share()).toBe(15);
    pointer('pointerup', document, 90);
    fixture.detectChanges();

    expect(host.ended).toEqual([15]);
    expect(splitter.getAttribute('aria-valuenow')).toBe('15');
  });

  it('ignores the pointer when it is not dragging, or with another button', async () => {
    const { host, splitter } = await renderSplitter();

    pointer('pointermove', document, 300);
    pointer('pointerup', document, 300);
    pointer('pointerdown', splitter, 300, 2);
    pointer('pointermove', document, 300);
    pointer('pointercancel', document, 300);

    expect(host.share()).toBe(45);
    expect(host.ended).toEqual([]);
  });

  it('ignores a container without height, as when it is hidden', async () => {
    const { host, splitter, container } = await renderSplitter();
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 0, 0));

    pointer('pointerdown', splitter, 300);
    pointer('pointermove', document, 300);

    expect(host.share()).toBe(45);
  });

  it('moves with the arrow keys, Home and End, and goes back to the default with a double click', async () => {
    const { host, splitter } = await renderSplitter();

    fireEvent.keyDown(splitter, { key: 'ArrowDown' });
    expect(host.share()).toBe(50);
    fireEvent.keyDown(splitter, { key: 'ArrowUp' });
    fireEvent.keyDown(splitter, { key: 'ArrowUp' });
    expect(host.share()).toBe(40);
    fireEvent.keyDown(splitter, { key: 'End' });
    expect(host.share()).toBe(70);
    fireEvent.keyDown(splitter, { key: 'Home' });
    expect(host.share()).toBe(15);
    fireEvent.keyDown(splitter, { key: 'a' });
    fireEvent.dblClick(splitter);

    expect(host.share()).toBe(45);
    expect(host.ended).toEqual([50, 45, 40, 70, 15, 45]);
  });

  describe('vertical, between two columns', () => {
    async function renderVertical() {
      const { fixture } = await render(RowHost);
      const splitter = screen.getByRole('separator', { name: 'Ancho del código' });
      vi.spyOn(screen.getByTestId('row'), 'getBoundingClientRect').mockReturnValue(
        new DOMRect(100, 0, 1000, 400), // left 100, width 1000
      );
      return { host: fixture.componentInstance, splitter };
    }

    it('says it is vertical', async () => {
      const { splitter } = await renderVertical();

      expect(splitter.getAttribute('aria-orientation')).toBe('vertical');
      expect(splitter.getAttribute('aria-valuenow')).toBe('70');
    });

    it('follows the pointer across the width', async () => {
      const { host, splitter } = await renderVertical();

      pointerX('pointerdown', splitter, 800);
      pointerX('pointermove', document, 700); // 600 of 1000 px
      pointerX('pointerup', document, 700);

      expect(host.share()).toBe(60);
      expect(host.ended).toEqual([60]);
    });

    it('moves with the left and right arrows, not with the up and down ones', async () => {
      const { host, splitter } = await renderVertical();

      fireEvent.keyDown(splitter, { key: 'ArrowLeft' });
      expect(host.share()).toBe(65);
      fireEvent.keyDown(splitter, { key: 'ArrowRight' });
      fireEvent.keyDown(splitter, { key: 'ArrowRight' });
      expect(host.share()).toBe(75);
      fireEvent.keyDown(splitter, { key: 'ArrowDown' });

      expect(host.share()).toBe(75);
      expect(host.ended).toEqual([65, 70, 75]);
    });
  });
});
