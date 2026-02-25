import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const incomingArgs = process.argv.slice(2)
const filteredArgs = incomingArgs.filter((arg) => arg !== '--runInBand')
const finalArgs = ['run', '--passWithNoTests', ...filteredArgs]
const require = createRequire(import.meta.url)
const vitestPkg = require.resolve('vitest/package.json')
const vitestBin = join(dirname(vitestPkg), 'vitest.mjs')

const child = spawn(process.execPath, [vitestBin, ...finalArgs], {
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

child.on('error', () => {
  process.exit(1)
})
