import { Component, inject, signal } from '@angular/core';
import { email, form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Signal Forms with Material fields: validation, errors under each field and submission. */
@Component({
  selector: 'app-showcase-form',
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
    MatCheckbox,
    MatSlideToggle,
    MatButton,
  ],
  templateUrl: './showcase-form.html',
})
export class ShowcaseForm {
  private readonly snackBar = inject(MatSnackBar);

  protected readonly difficulties = [
    { value: 'easy', label: 'Inicial' },
    { value: 'medium', label: 'Media' },
    { value: 'hard', label: 'Avanzada' },
  ];

  protected readonly model = signal({
    title: '',
    teacherEmail: '',
    difficulty: '',
    onlySignals: false,
    animations: true,
  });

  protected readonly exerciseForm = form(
    this.model,
    (path) => {
      required(path.title, { message: 'Introduce el título' });
      required(path.teacherEmail, { message: 'Introduce el correo' });
      email(path.teacherEmail, { message: 'El correo no es válido' });
      required(path.difficulty, { message: 'Elige una dificultad' });
    },
    {
      submission: {
        action: async () => {
          this.snackBar.open('Ejercicio guardado', 'Cerrar', { duration: 4000 });
        },
        // Focus management: move the focus to the first invalid field
        onInvalid: (field) => field().errorSummary()[0]?.fieldTree().focusBoundControl(),
      },
    },
  );
}
