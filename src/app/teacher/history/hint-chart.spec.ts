import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';

import type { BlockStats } from '../../data/stats-service';
import { HintChart } from './hint-chart';
import { blockStats } from './history-testing';

const blocks = signal<BlockStats[]>([]);
const selectedId = signal<string | undefined>(undefined);

@Component({
  imports: [HintChart],
  template: `<app-hint-chart [blocks]="blocks()" [students]="24" [selectedId]="selectedId()" />`,
})
class ChartHost {
  protected readonly blocks = blocks;
  protected readonly selectedId = selectedId;
}

describe('HintChart', () => {
  async function setup(shown: BlockStats[], selected?: string) {
    blocks.set(shown);
    selectedId.set(selected);
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'docente/historico', component: ChartHost }])],
    });
    await RouterTestingHarness.create('/docente/historico?grupo=g1');
    const list = screen.getByRole('list', { name: 'Pistas por ejercicio, bloque a bloque' });
    return {
      list,
      links: within(list).getAllByRole('link'),
      bars: within(list).getAllByTestId('hint-bar'),
    };
  }

  it('draws a bar per block of a falling series, with its value and height', async () => {
    const { links, bars } = await setup([
      blockStats('Tema 1', { hints: 44, attempts: 40 }),
      blockStats('Tema 2', { hints: 22, attempts: 40 }),
      blockStats('Tema 3', { hints: 11, attempts: 40 }),
    ]);

    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Tema 1: 1,1 pistas por ejercicio. Ver sus cifras',
      'Tema 2: 0,6 pistas por ejercicio. Ver sus cifras',
      'Tema 3: 0,3 pistas por ejercicio. Ver sus cifras',
    ]);
    expect(links.map((link) => within(link).getByText(/^\d,\d$/).textContent)).toEqual([
      '1,1',
      '0,6',
      '0,3',
    ]);
    expect(bars.map((bar) => bar.style.height)).toEqual(['100%', '50%', '25%']);
  });

  it('gives a block without hints its minimum height', async () => {
    const { bars } = await setup([blockStats('Tema 1', { hints: 0 })]);

    expect(bars[0].style.height).toBe('0%');
    expect(bars[0].classList).toContain('min-h-0.5');
  });

  it('highlights the column of the chosen block', async () => {
    const { links, bars } = await setup([blockStats('Tema 1'), blockStats('Tema 2')], 'Tema 2');

    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
    expect(
      links.map((link) => link.closest('li')?.classList.contains('bg-secondary-container')),
    ).toEqual([false, true]);
    expect(within(links[1]).getByText('Tema 2').classList).toContain('font-bold');
    expect(bars[1].classList).toContain('bg-primary');
  });

  it('explains its colours and what to do with it', async () => {
    await setup([blockStats('Tema 1')]);

    expect(screen.getByText('Cuenta para la tendencia')).toBeTruthy();
    expect(screen.queryByText('Menos de media clase: no cuenta')).toBeNull();
    expect(screen.getByText('Bloque elegido: su detalle, abajo')).toBeTruthy();
    expect(screen.getByText('Pulsa una barra para ver su detalle.')).toBeTruthy();
  });

  it('greys out a block few students worked on and says how many', async () => {
    const { list, bars } = await setup([
      blockStats('Tema 1'),
      blockStats('Recuperación', { activeStudents: 1, attempts: 1, hints: 1 }),
      blockStats('Repaso', { activeStudents: 3, attempts: 3, hints: 0 }),
    ]);

    expect(bars.map((bar) => bar.classList.contains('bg-outline-variant'))).toEqual([
      false,
      true,
      true,
    ]);
    expect(bars[0].classList).toContain('bg-primary');
    expect(within(list).getByText('1 alumno')).toBeTruthy();
    expect(screen.getByText('Menos de media clase: no cuenta')).toBeTruthy();
    expect(within(list).getByText('3 alumnos')).toBeTruthy();
  });

  it('marks the language of a title without translation', async () => {
    const english = blockStats('b1');
    const { links } = await setup([
      { ...english, block: { ...english.block, title: 'Loops', sourceLocale: 'en' } },
    ]);

    expect(within(links[0]).getByText('Loops').getAttribute('lang')).toBe('en');
  });

  it('links each bar to its block, keeping the group', async () => {
    const { links } = await setup([blockStats('b1'), blockStats('b2')]);

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/docente/historico?grupo=g1&bloque=b1',
      '/docente/historico?grupo=g1&bloque=b2',
    ]);
  });
});
