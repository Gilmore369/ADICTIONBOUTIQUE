import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'

dotenv.config({ path: path.resolve('.env.local'), quiet: true })

const apiKey = process.env.HEYGEN_API_KEY
const avatarId = process.env.HEYGEN_AVATAR_ID
const inputAudioPath = process.env.HEYGEN_AUDIO_PATH || 'public/videos/adiction-boutique-elevenlabs-voice.mp3'
const outputPath = process.env.HEYGEN_OUTPUT_PATH || 'public/videos/heygen-avatar-demo.mp4'
const title = process.env.HEYGEN_VIDEO_TITLE || 'Adiction Boutique Suite - Demo'

if (!apiKey) {
  throw new Error('Missing HEYGEN_API_KEY. Add it to .env.local before running npm run video:heygen.')
}

if (!avatarId) {
  throw new Error('Missing HEYGEN_AVATAR_ID. Pick one from your HeyGen dashboard and add it to .env.local.')
}

const audioBytes = await fs.readFile(inputAudioPath)

const uploadResponse = await fetch('https://upload.heygen.com/v1/asset', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'content-type': 'audio/mpeg',
  },
  body: audioBytes,
})

const uploadJson = await uploadResponse.json().catch(async () => ({ raw: await uploadResponse.text() }))
if (!uploadResponse.ok) {
  throw new Error(`HeyGen audio upload failed (${uploadResponse.status}): ${JSON.stringify(uploadJson)}`)
}

const uploadData = uploadJson.data ?? uploadJson
const audioAssetId = uploadData.id ?? uploadData.asset_id ?? uploadData.assetId

if (!audioAssetId) {
  throw new Error(`HeyGen upload did not return an audio asset id: ${JSON.stringify(uploadJson)}`)
}

console.log(`HeyGen audio asset uploaded: ${audioAssetId}`)

const generateBody = {
  title,
  avatar_id: avatarId,
  audio_asset_id: audioAssetId,
  aspect_ratio: process.env.HEYGEN_ASPECT_RATIO || '16:9',
  resolution: process.env.HEYGEN_RESOLUTION || '1080p',
  background: {
    type: 'color',
    color: process.env.HEYGEN_BACKGROUND_COLOR || '#050816',
  },
}

const generateResponse = await fetch('https://api.heygen.com/v2/videos', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'content-type': 'application/json',
  },
  body: JSON.stringify(generateBody),
})

const generateJson = await generateResponse.json().catch(async () => ({ raw: await generateResponse.text() }))
if (!generateResponse.ok) {
  throw new Error(`HeyGen video generation failed (${generateResponse.status}): ${JSON.stringify(generateJson)}`)
}

const generateData = generateJson.data ?? generateJson
const videoId = generateData.video_id ?? generateData.videoId ?? generateData.id

if (!videoId) {
  throw new Error(`HeyGen generation did not return a video id: ${JSON.stringify(generateJson)}`)
}

console.log(`HeyGen video requested: ${videoId}`)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let videoUrl = null

for (let attempt = 1; attempt <= 120; attempt += 1) {
  await sleep(15000)
  const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    headers: { 'x-api-key': apiKey },
  })
  const statusJson = await statusResponse.json().catch(async () => ({ raw: await statusResponse.text() }))
  if (!statusResponse.ok) {
    throw new Error(`HeyGen status failed (${statusResponse.status}): ${JSON.stringify(statusJson)}`)
  }

  const statusData = statusJson.data ?? statusJson
  const status = statusData.status
  console.log(`HeyGen status ${attempt}: ${status}`)

  if (status === 'completed') {
    videoUrl = statusData.video_url ?? statusData.videoUrl
    break
  }

  if (status === 'failed') {
    throw new Error(`HeyGen render failed: ${JSON.stringify(statusJson)}`)
  }
}

if (!videoUrl) {
  throw new Error(`HeyGen video did not complete in time. video_id=${videoId}`)
}

const videoResponse = await fetch(videoUrl)
if (!videoResponse.ok) {
  throw new Error(`HeyGen video download failed (${videoResponse.status})`)
}

const videoBytes = Buffer.from(await videoResponse.arrayBuffer())
await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, videoBytes)

console.log(`HeyGen avatar video downloaded: ${outputPath}`)
console.log(`Bytes: ${videoBytes.length}`)
