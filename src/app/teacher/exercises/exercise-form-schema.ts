import {
  applyEach,
  applyWhen,
  max,
  maxLength,
  min,
  required,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import { isIdentifier } from '../../data/exercise-names';
import {
  CONTENT_LOCALES,
  type ExerciseFormModel,
  hasText,
  parseArguments,
  parseValue,
  splitList,
  type TestRow,
  type TextFields,
} from './exercise-form-model';

/** Limits of the form, the same as the sliders show (CU-05). */
export const EXERCISE_LIMITS = {
  titleLength: 120,
  minRepeatedFailures: 1,
  maxRepeatedFailures: 10,
  minIdleMinutes: 1,
  maxIdleMinutes: 30,
  /** More would not read well in the skeleton of the tutor. */
  maxParameters: 6,
} as const;

/**
 * The validation of the exercise form (4.3, CU-05 5a): what the database checks, said to the
 * teacher next to each field, and what would make an exercise nobody could solve.
 */
export function exerciseSchema(path: SchemaPathTree<ExerciseFormModel>): void {
  for (const locale of CONTENT_LOCALES) {
    const texts = path.texts[locale];
    applyWhen(texts, ({ valueOf }) => valueOf(path.sourceLocale) === locale, sourceTexts);
    applyWhen(texts, ({ valueOf }) => valueOf(path.sourceLocale) !== locale, translationTexts);
    maxLength(texts.title, EXERCISE_LIMITS.titleLength, {
      message: $localize`:@@exerciseForm.error.titleLength:Como mucho ${EXERCISE_LIMITS.titleLength}:max: caracteres`,
    });
  }

  required(path.functionName, {
    message: $localize`:@@exerciseForm.error.functionRequired:Escribe el nombre de la función`,
  });
  validate(path.functionName, ({ value }) =>
    value().trim() === '' || isIdentifier(value().trim())
      ? null
      : {
          kind: 'identifier',
          message: $localize`:@@exerciseForm.error.functionName:Un nombre sin espacios, tildes ni ñ, como countVowels`,
        },
  );
  validate(path.parameters, ({ value }) => parametersError(splitList(value())));

  // The bank brings each teacher the exercises of their subjects: without one, nobody would find it
  validate(path.subjectIds, ({ value }) =>
    value().length === 0
      ? {
          kind: 'noSubject',
          message: $localize`:@@exerciseForm.error.noSubject:Elige al menos una asignatura`,
        }
      : null,
  );

  min(path.maxRepeatedFailures, EXERCISE_LIMITS.minRepeatedFailures);
  max(path.maxRepeatedFailures, EXERCISE_LIMITS.maxRepeatedFailures);
  min(path.maxIdleMinutes, EXERCISE_LIMITS.minIdleMinutes);
  max(path.maxIdleMinutes, EXERCISE_LIMITS.maxIdleMinutes);

  validate(path.tests, ({ value }) => testsError(value()));
  applyEach(path.tests, testRow);
}

/** The texts of the original language: the title and the statement are required. */
function sourceTexts(texts: SchemaPathTree<TextFields>): void {
  required(texts.title, {
    message: $localize`:@@exerciseForm.error.titleRequired:Escribe el título`,
  });
  required(texts.statement, {
    message: $localize`:@@exerciseForm.error.statementRequired:Escribe el enunciado`,
  });
}

/**
 * A translation is optional, but once started it needs its title and statement: without them the
 * student would read half the exercise in each language.
 */
function translationTexts(texts: SchemaPathTree<TextFields>): void {
  required(texts.title, {
    when: ({ valueOf }) => hasText(valueOf(texts)),
    message: $localize`:@@exerciseForm.error.translationTitle:Falta el título de la traducción`,
  });
  required(texts.statement, {
    when: ({ valueOf }) => hasText(valueOf(texts)),
    message: $localize`:@@exerciseForm.error.translationStatement:Falta el enunciado de la traducción`,
  });
}

function testRow(test: SchemaPathTree<TestRow>): void {
  validate(test.input, ({ value }) =>
    parseArguments(value()) === undefined
      ? {
          kind: 'json',
          message: $localize`:@@exerciseForm.error.input:Escribe los argumentos en JSON, con los textos entre comillas`,
        }
      : null,
  );
  validate(test.expected, ({ value }) =>
    parseValue(value()) === undefined
      ? {
          kind: 'json',
          message: $localize`:@@exerciseForm.error.expected:Escribe el valor en JSON, como 6, "hola" o [1, 2]`,
        }
      : null,
  );
}

function parametersError(names: readonly string[]) {
  if (names.some((name) => !isIdentifier(name))) {
    return {
      kind: 'identifier',
      message: $localize`:@@exerciseForm.error.parameterName:Nombres sin espacios, tildes ni ñ, separados por comas, como items, size`,
    };
  }
  if (new Set(names).size < names.length) {
    return {
      kind: 'repeated',
      message: $localize`:@@exerciseForm.error.parameterRepeated:Cada parámetro necesita un nombre distinto`,
    };
  }
  if (names.length > EXERCISE_LIMITS.maxParameters) {
    return {
      kind: 'tooMany',
      message: $localize`:@@exerciseForm.error.parameterCount:Como mucho ${EXERCISE_LIMITS.maxParameters}:max: parámetros`,
    };
  }
  return null;
}

/** A student only learns why a test fails if they can see one. */
function testsError(tests: readonly TestRow[]) {
  if (tests.length === 0) {
    return {
      kind: 'noTests',
      message: $localize`:@@exerciseForm.error.noTests:Añade al menos una prueba`,
    };
  }
  if (tests.every((test) => test.isHidden)) {
    return {
      kind: 'noVisibleTests',
      message: $localize`:@@exerciseForm.error.noVisibleTests:Deja al menos una prueba visible: el alumno aprende de ella`,
    };
  }
  return null;
}
