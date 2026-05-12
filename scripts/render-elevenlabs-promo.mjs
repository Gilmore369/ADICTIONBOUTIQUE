import fs from 'node:fs'
import { spawn } from 'node:child_process'

const voicePath = 'public/videos/adiction-boutique-elevenlabs-voice.mp3'
const outputPath = 'public/videos/adiction-boutique-demo-elevenlabs.mp4'

if (!fs.existsSync(voicePath)) {
  throw new Error(`Missing ${voicePath}. Run npm run video:elevenlabs first.`)
}

const props = {
  voicePath: 'videos/adiction-boutique-elevenlabs-voice.mp3',
}
const propsPath = 'public/videos/adiction-boutique-elevenlabs-props.json'
fs.writeFileSync(propsPath, JSON.stringify(props, null, 2))

const args = [
  'remotion',
  'render',
  'remotion/index.ts',
  'AdictionBoutiquePromo',
  outputPath,
  '--codec=h264',
  '--audio-codec=aac',
  `--props=${propsPath}`,
]

const child = spawn('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
