import fs from 'node:fs'
import { spawn } from 'node:child_process'

const timelinePath = 'remotion/generatedVoiceTimeline.ts'
const outputPath = 'public/videos/adiction-boutique-demo-sincronizado.mp4'

if (!fs.existsSync(timelinePath)) {
  throw new Error(`Missing ${timelinePath}. Run npm run video:elevenlabs:segments first.`)
}

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
