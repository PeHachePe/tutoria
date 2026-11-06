import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';

import { ShowcaseForm } from './showcase-form';

describe('ShowcaseForm', () => {
  let fixture: ComponentFixture<ShowcaseForm>;
  let loader: HarnessLoader;
  let overlays: HarnessLoader;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ShowcaseForm);
    loader = TestbedHarnessEnvironment.loader(fixture);
    overlays = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  async function field(label: string): Promise<MatFormFieldHarness> {
    return loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
  }

  async function submit(): Promise<void> {
    await (await loader.getHarness(MatButtonHarness.with({ text: 'Guardar ejercicio' }))).click();
    await fixture.whenStable();
  }

  it('shows the errors under each field and focuses the first invalid one', async () => {
    await submit();

    expect(await (await field('Título del ejercicio')).getTextErrors()).toEqual([
      'Introduce el título',
    ]);
    expect(await (await field('Correo del docente')).getTextErrors()).toEqual([
      'Introduce el correo',
    ]);
    expect(await (await field('Dificultad')).getTextErrors()).toEqual(['Elige una dificultad']);
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('input'),
    );
    expect(await overlays.getAllHarnesses(MatSnackBarHarness)).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const [, teacherEmail] = await loader.getAllHarnesses(MatInputHarness);
    await teacherEmail.setValue('no-es-un-correo');
    await submit();

    expect(await (await field('Correo del docente')).getTextErrors()).toEqual([
      'El correo no es válido',
    ]);
  });

  it('saves a valid exercise', async () => {
    const [title, teacherEmail] = await loader.getAllHarnesses(MatInputHarness);
    await title.setValue('Suma de un vector');
    await teacherEmail.setValue('marta@centro.es');
    const difficulty = await loader.getHarness(MatSelectHarness);
    await difficulty.open();
    await difficulty.clickOptions({ text: 'Media' });

    await submit();

    const snackBar = await overlays.getHarness(MatSnackBarHarness);
    expect(await snackBar.getMessage()).toBe('Ejercicio guardado');
  });
});
