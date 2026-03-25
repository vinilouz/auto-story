export async function loadAudioBuffer(url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext();
  return audioContext.decodeAudioData(arrayBuffer);
}
