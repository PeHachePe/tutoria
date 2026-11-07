import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatPaginatorHarness } from '@angular/material/paginator/testing';
import { MatSortHarness } from '@angular/material/sort/testing';
import { MatTableHarness } from '@angular/material/table/testing';

import { LocalizedPaginatorIntl } from '../../core/localized-paginator-intl';
import { ShowcaseTable } from './showcase-table';

describe('ShowcaseTable', () => {
  let loader: HarnessLoader;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: MatPaginatorIntl, useClass: LocalizedPaginatorIntl }],
    });
    const fixture = TestBed.createComponent(ShowcaseTable);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  async function names(): Promise<string[]> {
    const table = await loader.getHarness(MatTableHarness);
    return (await table.getCellTextByColumnName())['name'].text;
  }

  async function sortBy(label: string): Promise<void> {
    const sort = await loader.getHarness(MatSortHarness);
    const [header] = await sort.getSortHeaders({ label });
    await header.click();
  }

  it('shows the first five students with their status', async () => {
    const table = await loader.getHarness(MatTableHarness);
    const columns = await table.getCellTextByColumnName();

    expect(columns['name'].text).toEqual([
      'Alumno 1',
      'Alumno 2',
      'Alumno 3',
      'Alumno 4',
      'Alumno 5',
    ]);
    expect(columns['status'].text[2]).toBe('Atascado');
    expect(columns['minutes'].text[0]).toBe('18 min');
  });

  it('moves to the next page', async () => {
    const paginator = await loader.getHarness(MatPaginatorHarness);

    await paginator.goToNextPage();

    expect(await names()).toEqual(['Alumno 6', 'Alumno 7', 'Alumno 8']);
    expect(await paginator.getRangeLabel()).toBe('6 – 8 de 8');
  });

  it('sorts numbers ascending, then descending, then restores the order', async () => {
    await sortBy('Tiempo');
    expect((await names())[0]).toBe('Alumno 2'); // 6 min

    await sortBy('Tiempo');
    expect((await names())[0]).toBe('Alumno 7'); // 31 min

    await sortBy('Tiempo');
    expect((await names())[0]).toBe('Alumno 1');
  });

  it('goes back to the first page when the order changes', async () => {
    const paginator = await loader.getHarness(MatPaginatorHarness);
    await paginator.goToNextPage();

    await sortBy('Estado');

    expect(await paginator.getRangeLabel()).toBe('1 – 5 de 8');
    expect(await names()).toEqual(['Alumno 3', 'Alumno 7', 'Alumno 2', 'Alumno 5', 'Alumno 8']);
  });
});
