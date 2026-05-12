import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'

dotenv.config({ path: path.resolve('.env.local'), quiet: true })

const apiKey = process.env.ELEVENLABS_API_KEY
const voiceId = process.env.ELEVENLABS_VOICE_ID || 'VywzfvxxNk4yFAaoMm4Q'
const modelIds = (process.env.ELEVENLABS_MODEL_ID || 'eleven_v3,eleven_multilingual_v2')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean)
const inputPath = process.env.ELEVENLABS_SCRIPT_PATH || 'public/videos/adiction-boutique-voice.txt'
const outputPath = process.env.ELEVENLABS_OUTPUT_PATH || 'public/videos/adiction-boutique-elevenlabs-voice.mp3'
const outputFormat = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128'

if (!apiKey) {
  throw new Error('Missing ELEVENLABS_API_KEY. Add it to .env.local before running npm run video:elevenlabs.')
}

const text = await fs.readFile(inputPath, 'utf8')

let buffer = null
let usedModel = null
let lastError = null

for (const modelId of modelIds) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        language_code: 'es',
        voice_settings: {
          stability: Number(process.env.ELEVENLABS_STABILITY ?? 0.48),
          similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? 0.86),
          style: Number(process.env.ELEVENLABS_STYLE ?? 0.35),
          use_speaker_boost: true,
          speed: Number(process.env.ELEVENLABS_SPEED ?? 0.97),
        },
      }),
    },
  )

  if (response.ok) {
    buffer = Buffer.from(await response.arrayBuffer())
    usedModel = modelId
    break
  }

  lastError = `ElevenLabs TTS failed with ${modelId} (${response.status}): ${await response.text()}`
  console.warn(lastError)
}

if (!buffer) {
  throw new Error(lastError || 'ElevenLabs TTS failed')
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, buffer)

console.log(`ElevenLabs voice generated: ${outputPath}`)
console.log(`Model: ${usedModel}`)
console.log(`Bytes: ${buffer.length}`)
