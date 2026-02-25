import { spawn } from 'node:child_process'

const incomingArgs = process.argv.slice(2)
const filteredArgs = incomingArgs.filter((arg) => arg !== '--runInBand')
const finalArgs = ['run', '--passWithNoTests', ...filteredArgs]

const child = spawn('vitest', finalArgs, {
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})

child.on('error', () => {
  process.exit(1)
})
