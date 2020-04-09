const { resolve } = require('path');

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    // Common
    'eslint:recommended',
    'plugin:import/errors',
    'airbnb-base/legacy',
  ],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2018,
    parser: 'babel-eslint',
  },
  overrides: [
    {
      files: [
        '**/*.test.js',
        '**/*.spec.js'
      ],
      env: {
        jest: true // now **/*.test.js files' env has both es6 *and* jest
      },
      // Can't extend in overrides: https://github.com/eslint/eslint/issues/8813
      // 'extends': ['plugin:jest/recommended']
      plugins: ['jest'],
      rules: {
        'jest/no-disabled-tests': 'warn',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'error',
        'jest/prefer-to-have-length': 'warn',
        'jest/valid-expect': 'error'
      }
    }
  ],
  ignorePatterns: [
    'node_modules/',
    'docs/',
    'dist/',
    '**/*.ejs',
  ],
  rules: {
    'template-curly-spacing' : 'off',

    indent: [
      'error',
      2,
      {
        SwitchCase: 1,
        ignoredNodes: ['TemplateLiteral']
      },
    ],

    'linebreak-style': [
      'error',
      'unix'
    ],

    semi: [
      'error',
      'always'
    ],

    'no-unused-vars': [
      'error',
      { args: 'none' }
    ],

    'no-use-before-define': [
      'error',
      {
        functions: false,
        classes: false,
        variables: true
      }
    ],

    'import/no-unresolved': [
      'error',
      {
        commonjs: true,
        caseSensitive: true
      }
    ],

    'import/extensions': ['error', 'never', {
      css: 'always'
    }],

    'brace-style': ['error', 'stroustrup'],

    'space-unary-ops': [
        2, {
          words: true,
          nonwords: false,
          overrides: {
            '!': true,
          },
    }],

    'object-curly-newline': ['error', {
        ObjectPattern: { multiline: true },
      }
    ],

    'class-methods-use-this': 'off',

    'new-cap': ['error', {
      properties: false
    }],

    'no-param-reassign': [
      2, {
        'props': false
      }
    ],

    'comma-dangle': ['error', 'always-multiline'],

    'no-console': 'off',
  },
};
