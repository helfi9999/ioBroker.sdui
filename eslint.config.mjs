import config from '@iobroker/eslint-config';

export default [
    ...config,
    {
        ignores: [
            'node_modules/**',
            'widgets/**',
            'src-widgets/**',
            'admin/**',
            'coverage/**',
        ],
    },
    {
        files: [
            'main.js',
            'lib/**/*.js',
            'test/**/*.js',
        ],
        rules: {
            'prettier/prettier': 'off',
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'curly': 'warn',
            'prefer-template': 'warn',
            '@typescript-eslint/no-unused-vars': 'warn',
            'brace-style': 'warn',
        },
    },
];
