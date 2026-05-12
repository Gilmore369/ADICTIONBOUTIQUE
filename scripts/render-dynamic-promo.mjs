import { spawn } from 'node:child_process'

const outputPath = 'public/videos/adiction-boutique-demo-dinamico.mp4'

const args = [
  'remotion',
  'render',
  'remotion/index.ts',
  'AdictionBoutiquePromo',
  outputPath,
  '--codec=h264',
  '--audio-codec=aac',
]

const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
