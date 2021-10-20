import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import { terser } from 'rollup-plugin-terser'
import cleaner from 'rollup-plugin-cleaner'
import multiInput from 'rollup-plugin-multi-input';

export default {
  input: './src/txF-RandomPixels.js',
  output: {
    dir: 'dist',
    format: 'cjs',
    exports: 'default'
  },
  plugins: [
    cleaner({
      targets: ['./dist/']
    }),
    multiInput(),
    resolve({
      preferBuiltins: true
    }),
    babel({ 
      babelHelpers: 'bundled' 
    }),
    terser(),
  ],
  external: [
    'lodash',
    'bignumber.js',
    'stellar-sdk',
    'node-fetch',
  ]
}
