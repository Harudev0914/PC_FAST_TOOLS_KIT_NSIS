/* ESLint config — shared across React renderer (src/) and Electron main/services. */
module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: '18.2' } },
  plugins: ['react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // React 17+ automatic JSX runtime — no need to import React in scope.
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    // Surface the real bugs the audit found (stale deps, unused bindings) as warnings
    // so the build isn't blocked while the debt is paid down.
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    // Legacy patterns present throughout the existing codebase. Kept as warnings so
    // `npm run lint` passes on a first introduction while the debt stays visible:
    //  - control-regex: intentional \x00 matching in file-recovery / binary scans
    //  - the rest are pre-existing style/structure issues to be cleaned incrementally.
    'no-control-regex': 'off',
    'no-useless-escape': 'warn',
    'no-inner-declarations': 'warn',
    'no-unreachable': 'warn',
    'no-async-promise-executor': 'warn',
  },
  overrides: [
    {
      // Electron main process + services run in Node/CommonJS.
      files: ['electron/**/*.js', 'electron/**/*.cjs', '*.cjs'],
      env: { node: true, browser: false },
      parserOptions: { sourceType: 'script' },
      rules: { 'no-undef': 'off' },
    },
    {
      // Vite config is ESM.
      files: ['vite.config.js'],
      env: { node: true, browser: false },
      parserOptions: { sourceType: 'module' },
      rules: { 'no-undef': 'off' },
    },
  ],
  ignorePatterns: [
    'dist/',
    'dist-installer/',
    'node_modules/',
    'build/',
    '*.min.js',
  ],
};
