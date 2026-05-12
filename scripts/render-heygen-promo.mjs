import fs from 'node:fs'
import { spawn } from 'node:child_process'

const voicePath = 'public/videos/adiction-boutique-elevenlabs-voice.mp3'
const avatarPath = 'public/videos/heygen-avatar-demo.mp4'
const outputPath = 'public/videos/adiction-boutique-demo-heygen-elevenlabs.mp4'

for (const required of [voicePath, avatarPath]) {
  if (!fs.existsSync(required)) {
    throw new Error(`Missing ${required}. Run npm run video:elevenlabs and npm run video:heygen first.`)
  }
}

const props = {
  voicePath: 'videos/adiction-boutique-elevenlabs-voice.mp3',
  avatarVideoPath: 'videos/heygen-avatar-demo.mp4',
  showAvatar: true,
}
const propsPath = 'public/videos/adiction-boutique-heygen-props.json'
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
