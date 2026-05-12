# Video promocional con HeyGen + ElevenLabs

Este flujo genera una segunda version del video demo usando:

- ElevenLabs para la locucion IA natural.
- HeyGen para un avatar presentador sincronizado con esa locucion.
- Remotion para combinar el avatar con los pantallazos reales del ERP.

## 1. Configurar llaves

Agregar en `.env.local`:

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=VywzfvxxNk4yFAaoMm4Q
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

HEYGEN_API_KEY=...
HEYGEN_AVATAR_ID=...
```

Notas:
- `ELEVENLABS_VOICE_ID` usa por defecto una voz femenina latina/peruana de ElevenLabs. Puedes cambiarla por otra voz de la libreria si el cliente prefiere otro tono.
- `HEYGEN_AVATAR_ID` debe salir del dashboard de HeyGen.

## 2. Generar voz con ElevenLabs

### Opcion recomendada: voz sincronizada por escena

Este flujo genera un MP3 por pantalla del demo y crea el timeline real segun la duracion de cada frase. Es la version preferida porque la voz queda alineada con la pantalla que se esta mostrando.

```bash
npm run video:elevenlabs:segments
npm run video:render:synced
```

Salidas:

```text
public/videos/voice-segments/*.mp3
remotion/generatedVoiceTimeline.ts
public/videos/adiction-boutique-demo-sincronizado.mp4
```

### Opcion anterior: una sola pista larga

```bash
npm run video:elevenlabs
```

Salida:

```text
public/videos/adiction-boutique-elevenlabs-voice.mp3
```

## 3. Crear avatar en HeyGen

```bash
npm run video:heygen
```

Salida:

```text
public/videos/heygen-avatar-demo.mp4
```

## 4. Render final con Remotion

```bash
npm run video:render:heygen
```

Salida:

```text
public/videos/adiction-boutique-demo-heygen-elevenlabs.mp4
```

## Flujo completo

```bash
npm run video:elevenlabs
npm run video:heygen
npm run video:render:heygen
```

## Archivos relevantes

- `scripts/generate-elevenlabs-voice.mjs`
- `scripts/generate-elevenlabs-segments.mjs`
- `scripts/render-synced-promo.mjs`
- `scripts/create-heygen-avatar-video.mjs`
- `scripts/render-heygen-promo.mjs`
- `remotion/PromoVideo.tsx`
- `public/videos/adiction-boutique-voice.txt`
- `public/videos/adiction-boutique-voice-segments.json`
