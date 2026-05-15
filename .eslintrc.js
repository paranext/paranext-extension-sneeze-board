// #region shared with https://github.com/paranext/paranext-multi-extension-template/blob/main/.eslintrc.cjs

module.exports = {
  extends: [
    // https://github.com/airbnb/javascript/tree/master/packages/eslint-config-airbnb
    'airbnb',
    'airbnb/hooks',
    'plugin:promise/recommended',
    'plugin:compat/recommended',
    // https://github.com/import-js/eslint-plugin-import?tab=readme-ov-file#typescript
    'plugin:import/recommended',
    'plugin:import/typescript',
    // Make sure this is last so it gets the chance to override other configs.
    // See https://github.com/prettier/eslint-config-prettier and https://github.com/prettier/eslint-plugin-prettier
    'plugin:prettier/recommended',
  ],
  env: {
    browser: true,
    node: true,
  },

  rules: {
    // Some rules in this following shared region are not applied since they are overridden in subsequent regions
    // #region shared with https://github.com/paranext/paranext-core/blob/main/.eslintrc.js

    // #region ERB rules

    // Use `noImplicitReturns` instead. See https://typescript-eslint.io/rules/consistent-return/.
    'consistent-return': 'off',
    'import/default': 'off',
    'import/extensions': 'off',
    // A temporary hack related to IDE not resolving correct package.json
    'import/no-extraneous-dependencies': 'off',
    'import/no-import-module-exports': 'off',
    'import/no-unresolved': 'error',
    'import/prefer-default-export': 'off',
    'no-param-reassign': ['error', { props: false }],
    'react/jsx-filename-extension': 'off',
    'react/react-in-jsx-scope': 'off',

    // #endregion

    // #region Platform.Bible rules

    // Rules in each section are generally in alphabetical order. However, several
    // `@typescript-eslint` rules require disabling the equivalent ESLint rule. So in these cases
    // each ESLint rule is turned off immediately above the corresponding `@typescript-eslint` rule.
    'class-methods-use-this': 'off',
    '@typescript-eslint/class-methods-use-this': [
      'error',
      { ignoreOverrideMethods: true, ignoreClassesThatImplementAnInterface: false },
    ],
    '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'no-public' }],
    'lines-between-class-members': 'off',
    '@stylistic/ts/lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true, exceptAfterOverload: true },
    ],
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variableLike',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'enumMember',
        format: ['PascalCase'],
      },
      {
        selector: 'function',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],
    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': [
      'error',
      {
        allow: ['arrowFunctions', 'functions', 'methods'],
      },
    ],
    '@typescript-eslint/no-explicit-any': 'error',
    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['shared/*', 'renderer/*', 'extension-host/*', 'node/*', 'client/*', 'main/*'],
            message: `Importing from this path is not allowed. Try importing from @papi/core. Imports from paths like 'shared', 'renderer', 'node', 'client' and 'main' are not allowed to prevent unnecessary import break.`,
          },
        ],
      },
    ],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'error',
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': [
      'error',
      { functions: false, allowNamedExports: true, typedefs: false, ignoreTypeReferences: true },
    ],
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    'no-useless-constructor': 'off',
    '@typescript-eslint/no-useless-constructor': 'error',
    'comma-dangle': ['error', 'always-multiline'],
    'import/no-anonymous-default-export': ['error', { allowCallExpression: false }],
    indent: 'off',
    'jsx-a11y/label-has-associated-control': [
      'error',
      {
        assert: 'either',
      },
    ],
    // Should use our logger anytime you want logs that persist. Otherwise use console only in testing
    'no-console': 'warn',
    'no-null/no-null': 2,
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-type-assertion/no-type-assertion': 'error',
    'prettier/prettier': ['warn', { tabWidth: 2, trailingComma: 'all' }],
    'react/jsx-indent-props': ['warn', 2],
    'react/jsx-props-no-spreading': ['error', { custom: 'ignore' }],
    'react/require-default-props': 'off',

    // #endregion

    // #endregion

    // #region Overrides to rules from paranext-core

    'import/no-unresolved': ['error', { ignore: ['@papi'] }],

    // #endregion
  },
  globals: {
    globalThis: 'readonly',
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        // #region shared with https://github.com/paranext/paranext-core/blob/main/.eslintrc.js

        // These are already handled by TypeScript
        'no-dupe-class-members': 'off',

        // #endregion
      },
    },
    {
      // Allow this file to have overrides to rules from paranext-core
      files: ['.eslintrc.*js'],
      rules: {
        'no-dupe-keys': 'off',
      },
    },
    {
      files: ['*.js'],
      rules: {
        strict: 'off',
      },
    },
    {
      files: ['./lib/*', './webpack/*'],
      rules: {
        // These files are scripts not running in Platform.Bible, so they can't use the logger
        'no-console': 'off',
      },
    },
    {
      files: ['*.d.ts'],
      rules: {
        // Allow .d.ts files to self import so they can refer to their types in `papi-shared-types`
        'import/no-self-import': 'off',
      },
    },
    {
      // Bridge protobuf / binary protocol code legitimately needs bitwise ops.
      files: ['src/bridge/network-comms/**/*.ts'],
      rules: {
        'no-bitwise': 'off',
        'no-plusplus': 'off',
      },
    },
    {
      // Bridge / main use null sentinels from Node API surface (regex .match returns null, etc.).
      // Also use `as` for IPC message types and webview side-effect assignment.
      files: ['src/bridge/**/*.ts', 'src/main.ts', 'src/web-views/**/*.{ts,tsx}'],
      rules: {
        'no-null/no-null': 'off',
        'no-type-assertion/no-type-assertion': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        'no-nested-ternary': 'off',
        'no-restricted-syntax': 'off',
        'promise/catch-or-return': 'off',
        'promise/always-return': 'off',
      },
    },
    {
      // Test files use ! non-null assertions extensively.
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'no-type-assertion/no-type-assertion': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        'import/order': 'off',
        '@typescript-eslint/no-shadow': 'off',
      },
    },
    {
      // Stats utilities iterate over Map.entries() and arrays via for-of for clarity.
      files: ['src/util/**/*.ts'],
      rules: {
        'no-restricted-syntax': 'off',
        'no-plusplus': 'off',
        'no-type-assertion/no-type-assertion': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      },
    },
    {
      // Webpack configs may use intentional path-separator regex escapes.
      files: ['webpack/**/*.ts', 'vitest.config.ts'],
      rules: {
        'no-useless-escape': 'off',
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.lint.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', '@stylistic/ts', 'no-type-assertion', 'no-null'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
      },
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};

// #endregion
