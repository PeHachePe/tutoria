import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required, validate } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

import { type ToolRun, ToolRegistry } from '../../core/tools/app-tool';

/**
 * The tools open now, as an agent of WebMCP would see them (2.5e): pick one, write its arguments in
 * JSON and run it, in any browser, also without WebMCP. It runs them through the registry, with the
 * same checks as our tutor and the agents.
 */
@Component({
  selector: 'app-tool-inspector',
  imports: [
    FormRoot,
    FormField,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  template: `
    <form [formRoot]="toolForm" class="flex flex-col gap-2">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Herramienta</mat-label>
        <mat-select [formField]="toolForm.tool">
          @for (tool of tools(); track tool.name) {
            <mat-option [value]="tool.name">
              {{ tool.name }} · {{ tool.webMcp ? 'WebMCP' : 'solo el tutor' }}
            </mat-option>
          } @empty {
            <mat-option disabled>Esta pantalla no tiene herramientas</mat-option>
          }
        </mat-select>
        @if (description(); as text) {
          <mat-hint>{{ text }}</mat-hint>
        }
        @for (error of toolForm.tool().errors(); track error.kind) {
          <mat-error>{{ error.message }}</mat-error>
        }
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Argumentos (JSON)</mat-label>
        <textarea matInput rows="3" class="font-mono" [formField]="toolForm.args"></textarea>
        @for (error of toolForm.args().errors(); track error.kind) {
          <mat-error>{{ error.message }}</mat-error>
        }
      </mat-form-field>
      <button matButton="outlined" type="submit" class="self-start">Ejecutar</button>
    </form>
    <pre
      class="max-h-48 overflow-auto rounded-lg bg-surface-container p-2 font-mono text-body-small whitespace-pre-wrap"
      aria-live="polite"
      aria-label="Resultado"
      >{{ result() }}</pre>
  `,
  host: { class: 'flex flex-col gap-2' },
})
export class ToolInspector {
  private readonly registry = inject(ToolRegistry);

  protected readonly tools = this.registry.tools;
  private readonly model = signal({ tool: '', args: '{}' });
  private readonly run = signal<ToolRun | null>(null);

  protected readonly toolForm = form(
    this.model,
    (path) => {
      required(path.tool, { message: 'Elige una herramienta' });
      validate(path.args, ({ value }) =>
        parsed(value()) === undefined
          ? { kind: 'json', message: 'Escribe un JSON válido, como {}' }
          : null,
      );
    },
    {
      submission: {
        action: async () => {
          const { tool, args } = this.model();
          this.run.set(await this.registry.run(tool, parsed(args)));
        },
      },
    },
  );

  protected readonly description = computed(
    () => this.tools().find((tool) => tool.name === this.model().tool)?.description,
  );

  protected readonly result = computed(() => {
    const run = this.run();
    if (!run) return 'Sin ejecutar todavía.';
    return JSON.stringify(run.ok ? run.result : { error: run.error }, null, 2) ?? 'Hecho.';
  });
}

/** The arguments as JSON, or undefined if they are not valid JSON. */
function parsed(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
