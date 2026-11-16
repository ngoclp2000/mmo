import js from '@eslint/js';
import ts from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
export default ts.config({ignores:['**/dist/**','**/node_modules/**','playwright-report/**','test-results/**']}, js.configs.recommended, ...ts.configs.recommended, ...vue.configs['flat/essential'], {files:['**/*.vue'],languageOptions:{parserOptions:{parser:ts.parser}},rules:{'no-undef':'off'}}, {files:['**/*.ts'],rules:{'@typescript-eslint/no-explicit-any':'error'}}, {files:['**/*.js'],languageOptions:{globals:{process:'readonly'}}});
