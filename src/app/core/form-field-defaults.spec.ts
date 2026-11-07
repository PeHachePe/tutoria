import { TestBed } from '@angular/core/testing';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

import { provideFormFieldDefaults } from './form-field-defaults';

describe('provideFormFieldDefaults', () => {
  it('draws form fields with the outline appearance', () => {
    TestBed.configureTestingModule({ providers: [provideFormFieldDefaults()] });

    expect(TestBed.inject(MAT_FORM_FIELD_DEFAULT_OPTIONS).appearance).toBe('outline');
  });
});
