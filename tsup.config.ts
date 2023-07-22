import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  minify: true,
  // We have to bundle fs-capacitor because the author is too lazy to support cjs
  noExternal: ['fs-capacitor']
});