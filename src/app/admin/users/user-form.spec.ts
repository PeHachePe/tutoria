import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';

import { MAX_PASSWORD_LENGTH, MAX_USER_NAME_LENGTH } from '../../data/admin/user-rules';
import { USERS } from '../../data/mock/fixtures/users';
import {
  toNewUser,
  toUserChanges,
  toUserFormModel,
  type UserFormModel,
  userSchema,
  type UserSchemaOptions,
} from './user-form';

const [, marta] = USERS;

const VALID: UserFormModel = {
  name: 'Clara Fuentes',
  email: 'clara.fuentes@tutoria.test',
  role: 'teacher',
  password: 'contraseña',
};

const OPTIONS: UserSchemaOptions = {
  takenEmails: () => new Set([marta.email]),
  editing: false,
  roleLock: null,
};

function userForm(model: UserFormModel, options: Partial<UserSchemaOptions> = {}) {
  return form(signal(model), userSchema({ ...OPTIONS, ...options }), {
    injector: TestBed.inject(Injector),
  });
}

function messages(field: () => { errors(): readonly { message?: string }[] }): string[] {
  return field()
    .errors()
    .map((error) => error.message ?? '');
}

describe('toUserFormModel', () => {
  it('starts a new account as a student', () => {
    expect(toUserFormModel(null)).toEqual({ name: '', email: '', role: 'student', password: '' });
  });

  it('takes the name, the email and the role of an account', () => {
    expect(toUserFormModel(marta)).toEqual({
      name: marta.name,
      email: marta.email,
      role: 'teacher',
      password: '',
    });
  });
});

describe('userSchema', () => {
  it('accepts a complete new account', () => {
    expect(userForm(VALID)().valid()).toBe(true);
  });

  it('asks for a name, not too long', () => {
    expect(messages(userForm({ ...VALID, name: '' }).name)).toEqual(['Escribe el nombre']);
    expect(
      messages(userForm({ ...VALID, name: 'a'.repeat(MAX_USER_NAME_LENGTH + 1) }).name),
    ).toEqual([`Como mucho ${MAX_USER_NAME_LENGTH} caracteres`]);
  });

  it('asks for a valid email without an account, whatever its case', () => {
    expect(messages(userForm({ ...VALID, email: '' }).email)).toEqual(['Escribe el correo']);
    expect(messages(userForm({ ...VALID, email: 'clara' }).email)).toEqual([
      'Escribe un correo válido, como nombre@centro.es',
    ]);
    expect(messages(userForm({ ...VALID, email: ' Marta.Ibanez@Tutoria.test ' }).email)).toEqual([
      'Ese correo ya tiene una cuenta',
    ]);
    expect(messages(userForm({ ...VALID, email: `${'a'.repeat(250)}@b.es` }).email)).toEqual([
      'Como mucho 254 caracteres',
    ]);
  });

  it('asks for a password between the limits', () => {
    expect(messages(userForm({ ...VALID, password: '' }).password)).toEqual([
      'Escribe o genera una contraseña',
    ]);
    expect(messages(userForm({ ...VALID, password: 'corta' }).password)).toEqual([
      'Al menos 8 caracteres',
    ]);
    expect(
      messages(userForm({ ...VALID, password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1) }).password),
    ).toEqual([`Como mucho ${MAX_PASSWORD_LENGTH} caracteres`]);
  });

  it('checks neither the email nor the password of an existing account', () => {
    const editing = userForm({ ...toUserFormModel(marta), name: 'Marta' }, { editing: true });

    expect(editing().valid()).toBe(true);
  });

  it('disables the role with its reason', () => {
    expect(userForm(VALID).role().disabled()).toBe(false);
    const locked = userForm(VALID, { roleLock: 'Tiene grupos' }).role();
    expect(locked.disabled()).toBe(true);
    expect(locked.disabledReasons().map((reason) => reason.message)).toEqual(['Tiene grupos']);
  });
});

describe('toNewUser', () => {
  it('trims the name and the email, not the password', () => {
    expect(toNewUser({ ...VALID, name: ' Clara ', email: ' c@b.es ', password: ' x y ' })).toEqual({
      name: 'Clara',
      email: 'c@b.es',
      role: 'teacher',
      password: ' x y ',
    });
  });
});

describe('toUserChanges', () => {
  it('is empty without changes', () => {
    expect(toUserChanges(marta, { ...toUserFormModel(marta), name: ` ${marta.name} ` })).toEqual(
      {},
    );
  });

  it('sends only what changes', () => {
    expect(toUserChanges(marta, { ...toUserFormModel(marta), name: 'Marta Ibáñez' })).toEqual({
      name: 'Marta Ibáñez',
    });
    expect(toUserChanges(marta, { ...toUserFormModel(marta), role: 'admin' })).toEqual({
      role: 'admin',
    });
  });
});
