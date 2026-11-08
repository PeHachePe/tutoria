// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    languageOptions: {
      // Type information for the rules that inspect Angular's API annotations
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    processor: angular.processInlineTemplates,
    rules: {
      // Angular best practices from CLAUDE.md, enforced by `ng lint`
      '@angular-eslint/prefer-on-push-component-change-detection': [
        'error',
        { allowExplicitOnPush: false },
      ],
      '@angular-eslint/prefer-host-metadata-property': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-signal-model': 'error',
      '@angular-eslint/prefer-output-emitter-ref': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
      '@angular-eslint/prefer-service-decorator': 'error',
      '@angular-eslint/relative-url-prefix': 'error',
      // Only stable Angular APIs
      '@angular-eslint/no-experimental': 'error',
      '@angular-eslint/no-developer-preview': 'error',
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // Angular best practices from CLAUDE.md: NgOptimizedImage, no ngClass/ngStyle
      '@angular-eslint/template/prefer-ngsrc': 'error',
      '@angular-eslint/template/prefer-class-binding': 'error',
      '@angular-eslint/template/prefer-style-binding': 'error',
      // Every user-facing text is marked for translation, with a custom ID (step 1.1c, D-023).
      // Icon ligatures and the technical attributes below are not text for people.
      '@angular-eslint/template/i18n': [
        'error',
        {
          checkId: true,
          ignoreTags: ['mat-icon'],
          ignoreAttributes: [
            'appearance',
            'aria-controls',
            'aria-labelledby',
            'ariaCurrentWhenActive',
            'autocomplete',
            'd',
            'data-testid',
            'matButton',
            'matTooltipPosition',
            'mode',
            'mood',
            'patternUnits',
            'scope',
            'stroke-linecap',
            'stroke-linejoin',
            'transform',
            'xPosition',
            'yPosition',
          ],
        },
      ],
    },
  },
  {
    // Not translated: the templates of the tests, and the development tools (dev toolbar, showcase
    // and data explorer), which never reach a production build (D-014, D-023)
    files: ['**/*.spec.ts/**/*.html', 'src/app/dev/**/*.html', 'src/index.html'],
    rules: { '@angular-eslint/template/i18n': 'off' },
  },
]);
