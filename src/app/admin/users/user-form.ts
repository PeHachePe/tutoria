import {
  disabled,
  maxLength,
  minLength,
  required,
  type SchemaPath,
  type SchemaPathTree,
  validate,
} from '@angular/forms/signals';

import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
} from '../../data/admin/user-rules';
import type { NewUser, UserChanges } from '../../data/admin-service';
import type { AppUser, Role } from '../../data/user';

/** Something, an at sign and a domain with a dot: the rest is for Auth to judge. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An account as its dialog edits it (5.1b). The email and the password, only in a new one. */
export interface UserFormModel {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly password: string;
}

/** A new account starts as a student, the most common one. */
export function toUserFormModel(user: AppUser | null): UserFormModel {
  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'student',
    password: '',
  };
}

export interface UserSchemaOptions {
  /** The emails that already have an account, normalized: the list already loaded (CU-06 3a). */
  readonly takenEmails: () => ReadonlySet<string>;
  /** An existing account: its email does not change and its password is reset apart (D-072). */
  readonly editing: boolean;
  /** Why its role cannot change (`roleLock()`), or null. */
  readonly roleLock: string | null;
}

/** The limits of `user-rules.ts`, which the server checks too, said next to each field. */
export function userSchema({ takenEmails, editing, roleLock }: UserSchemaOptions) {
  return (path: SchemaPathTree<UserFormModel>): void => {
    required(path.name, {
      message: $localize`:@@userForm.error.name:Escribe el nombre`,
    });
    maxLength(path.name, MAX_USER_NAME_LENGTH, {
      message: $localize`:@@userForm.error.nameLength:Como mucho ${MAX_USER_NAME_LENGTH}:max: caracteres`,
    });
    disabled(path.role, { when: () => roleLock ?? false });
    if (editing) return;

    required(path.email, {
      message: $localize`:@@userForm.error.email:Escribe el correo`,
    });
    // Pasted with spaces around it is still an email: they go when saving
    validate(path.email, ({ value }) =>
      value().trim() === '' || EMAIL_SHAPE.test(value().trim())
        ? null
        : {
            kind: 'email',
            message: $localize`:@@userForm.error.emailFormat:Escribe un correo válido, como nombre@centro.es`,
          },
    );
    maxLength(path.email, MAX_EMAIL_LENGTH, {
      message: $localize`:@@userForm.error.emailLength:Como mucho ${MAX_EMAIL_LENGTH}:max: caracteres`,
    });
    validate(path.email, ({ value }) =>
      takenEmails().has(normalizeEmail(value()))
        ? {
            kind: 'taken',
            message: $localize`:@@userDialog.email.taken:Ese correo ya tiene una cuenta`,
          }
        : null,
    );
    passwordRules(path.password);
  };
}

/** A new password, also the one of a reset. */
export function passwordRules(password: SchemaPath<string>): void {
  required(password, {
    message: $localize`:@@userForm.error.password:Escribe o genera una contraseña`,
  });
  minLength(password, MIN_PASSWORD_LENGTH, {
    message: $localize`:@@userForm.error.passwordShort:Al menos ${MIN_PASSWORD_LENGTH}:min: caracteres`,
  });
  maxLength(password, MAX_PASSWORD_LENGTH, {
    message: $localize`:@@userForm.error.passwordLong:Como mucho ${MAX_PASSWORD_LENGTH}:max: caracteres`,
  });
}

/** What is created: the name and the email without surrounding spaces; the password as written. */
export function toNewUser(model: UserFormModel): NewUser {
  return {
    name: model.name.trim(),
    email: model.email.trim(),
    role: model.role,
    password: model.password,
  };
}

/** Only what changes: an unchanged role is not sent, so the server does not weigh it (D-072). */
export function toUserChanges(user: AppUser, model: UserFormModel): UserChanges {
  const name = model.name.trim();
  return {
    ...(name === user.name ? {} : { name }),
    ...(model.role === user.role ? {} : { role: model.role }),
  };
}
