# Geral
* [ ] revisao de clean code e clean arch do que esta feito
* [ ] transcrições apenas referenciarem o arquivo com a transcrição completa
* [ ] envio de image ref como base64 via formdata no payload e nao path fixo de imagem seguindo o padrao de https://api.louzlabs.com.br/openapi.json
* [ ] click em imagem para ver grande, abrir em lightbox interativa com setas para quando a mais (stages de entities, segments e clips de video)

# Ajustes
* [ ] bug de titulo de projetos, verificar existencia de função util para criação e localização e sempre usar ela (SSOT)
* [ ] concurrency para metade dos cores na renderização do remotion
* [ ] lazy loading no frontend na visualização dos stages de imagem e video
* [ ] fazer o volume dos clips de videos iniciarem em 0% 
* [ ] Aplicar o compressor de audio seguindo o codigo exemplo:

```tsx
"use client";

import { useRef, useState, RefObject } from 'react';

// --- INFRAESTRUTURA / DOMÍNIO (Isola a API de Áudio da UI) ---
function useAudioDucking(audioRef: RefObject<HTMLAudioElement | null>) {
  const [isDucked, setIsDucked] = useState(false);
  const nodes = useRef<{ ctx: AudioContext; src: MediaElementAudioSourceNode; comp: DynamicsCompressorNode } | null>(null);

  const init = () => {
    if (nodes.current || !audioRef.current) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(audioRef.current);
    const comp = ctx.createDynamicsCompressor();

    // Valores diretos (mais limpo que setValueAtTime para inicialização)
    comp.threshold.value = -35;
    comp.ratio.value = 20;
    comp.knee.value = 0;
    comp.attack.value = 0;
    comp.release.value = 0.21;

    nodes.current = { ctx, src, comp };
    src.connect(ctx.destination);
  };

  const toggle = () => {
    init();
    if (!nodes.current) return;
    const { ctx, src, comp } = nodes.current;

    // Reseta conexões
    src.disconnect();
    comp.disconnect();

    // Encadeamento limpo de nós de áudio
    if (!isDucked) src.connect(comp).connect(ctx.destination);
    else src.connect(ctx.destination);

    setIsDucked(prev => !prev);
  };

  return { isDucked, toggle, init };
}

// --- APRESENTAÇÃO / VIEW (Apenas renderiza e escuta eventos) ---
export default function AudioBedCompressor() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isDucked, toggle, init } = useAudioDucking(audioRef);

  return (
    <div className="p-6 border rounded-lg shadow-md max-w-md mx-auto mt-10 bg-slate-50">
      <h2 className="text-xl font-bold mb-2">Cama de Áudio</h2>
      <p className="text-xs text-gray-500 mb-4">Achata a música em -35dB.</p>
      
      <audio 
        ref={audioRef} 
        src="/sua-musica-de-fundo.mp3" 
        controls 
        className="w-full mb-4"
        onPlay={init} 
      />

      <button
        onClick={toggle}
        className={`w-full py-3 rounded font-bold text-white transition-colors ${
          isDucked ? 'bg-indigo-600' : 'bg-gray-400'
        }`}
      >
        {isDucked ? 'Compressor LIGADO' : 'Áudio Original'}
      </button>
    </div>
  );
}
```