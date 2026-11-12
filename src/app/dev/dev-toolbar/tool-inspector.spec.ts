import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { appTool, ToolRegistry } from '../../core/tools/app-tool';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import { ToolInspector } from './tool-inspector';

describe('ToolInspector', () => {
  async function setup(withTools = true) {
    await render(ToolInspector);
    const progress = vi.fn((): unknown => ({ pending: 3 }));
    if (withTools) {
      const registry = TestBed.inject(ToolRegistry);
      const destroyRef = TestBed.inject(DestroyRef);
      registry.register(appTool(TUTOR_TOOL.getMyProgress, progress), destroyRef);
      registry.register(
        { ...appTool(TUTOR_TOOL.setLayout, () => undefined), webMcp: false },
        destroyRef,
      );
    }
    return { progress, user: userEvent.setup() };
  }

  async function choose(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
    await user.click(screen.getByRole('combobox', { name: 'Herramienta' }));
    await user.click(await screen.findByRole('option', { name }));
  }

  const result = () => screen.getByLabelText('Resultado').textContent;

  it('runs the tool chosen with its arguments and shows what it gave', async () => {
    const { progress, user } = await setup();
    await choose(user, /getMyProgress · WebMCP/);
    expect(screen.getByText(TUTOR_TOOL.getMyProgress.description)).toBeTruthy();
    expect(result()).toBe('Sin ejecutar todavía.');

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));

    expect(progress).toHaveBeenCalledWith({}, expect.anything());
    expect(JSON.parse(result() ?? '')).toEqual({ pending: 3 });
  });

  it('says what the tool turned down, and when it gave nothing', async () => {
    const { user } = await setup();
    await choose(user, /setLayout · solo el tutor/);
    const args = screen.getByRole('textbox', { name: 'Argumentos (JSON)' });

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(JSON.parse(result() ?? '')).toEqual({ error: 'arguments: at least 1 properties' });

    await user.clear(args);
    await user.type(args, '{{"tab":"code"}');
    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    expect(result()).toBe('Hecho.');
  });

  it('asks for a tool and for valid JSON before running anything', async () => {
    const { progress, user } = await setup();
    const args = screen.getByRole('textbox', { name: 'Argumentos (JSON)' });
    await user.clear(args);
    await user.type(args, 'no');

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));

    expect(screen.getByText('Elige una herramienta')).toBeTruthy();
    expect(screen.getByText('Escribe un JSON válido, como {}')).toBeTruthy();
    expect(progress).not.toHaveBeenCalled();
  });

  it('says when the screen has no tools', async () => {
    const { user } = await setup(false);
    await user.click(screen.getByRole('combobox', { name: 'Herramienta' }));
    expect(
      await screen.findByRole('option', { name: 'Esta pantalla no tiene herramientas' }),
    ).toBeTruthy();
  });
});
