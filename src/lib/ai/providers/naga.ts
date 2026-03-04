import { registerProvider, AudioRequest, AudioResponse } from '../registry'

registerProvider({
  name: 'naga',

  async generateAudio(model, req: AudioRequest, creds): Promise<AudioResponse> {
    const res = await fetch(`${creds.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify({ model, input: req.text, voice: req.voice }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).substring(0, 200)}`)

    const audioBuffer = await res.arrayBuffer()
    if (!audioBuffer.byteLength) throw new Error('Empty audio')
    return { audioBuffer }
  },
})
