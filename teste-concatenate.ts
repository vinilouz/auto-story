import {
  Input,
  Output,
  Mp3OutputFormat,
  ALL_FORMATS,
  FilePathSource,
  FilePathTarget,
  EncodedPacketSink,
  EncodedAudioPacketSource,
} from "mediabunny";

// 1. Defina seus arquivos locais de entrada e o caminho de saída
const INPUT_FILES = [
  "public/projects/712ef2ac-4eb0-4281-8310-d9c5e8110286/audios/audio_1774549774675_pgq6e.mp3",
  "public/projects/712ef2ac-4eb0-4281-8310-d9c5e8110286/audios/audio_1774549862731_colzi.mp3",
  "public/projects/712ef2ac-4eb0-4281-8310-d9c5e8110286/audios/audio_1774549862893_y4z18.mp3",
];
const OUTPUT_FILE = "./mix_final.mp3";

export async function mergeMp3Files(
  inputPaths: string[],
  outputPath: string,
): Promise<void> {
  if (inputPaths.length === 0)
    throw new Error("A lista de arquivos está vazia.");

  // 2. Configura a saída usando FilePathTarget para gravar os blocos direto no disco
  const target = new FilePathTarget(outputPath, { chunked: true });
  const outputMuxer = new Output({
    format: new Mp3OutputFormat(),
    target: target,
  });

  // 3. Inicializa a fonte de pacotes que escreverá o áudio no novo arquivo
  // O formato 'mp3' indica o tipo de pacote comprimido que vamos despejar
  const packetSource = new EncodedAudioPacketSource("mp3");

  let isOutputStarted = false;
  let globalTimestamp = 0; // Usado para enfileirar as faixas uma após a outra

  // 4. Itera sobre cada arquivo na ordem especificada
  for (const path of inputPaths) {
    // Carrega o arquivo local
    const input = new Input({
      source: new FilePathSource(path),
      formats: ALL_FORMATS,
    });

    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) {
        console.warn(
          `[Aviso] O arquivo ${path} não possui faixa de áudio. Pulando...`,
        );
        continue;
      }

      // 4.1. Na primeira iteração, pegamos as propriedades gerais para iniciar o Output
      if (!isOutputStarted) {
        outputMuxer.addAudioTrack(packetSource, {
          numberOfChannels: track.numberOfChannels,
          sampleRate: track.sampleRate,
        });
        await outputMuxer.start();
        isOutputStarted = true;
      }

      // 4.2. Criamos um "sink" para drenar todos os pacotes brutos codificados da faixa original
      const sink = new EncodedPacketSink(track);
      const duration = await track.computeDuration();

      // 4.3. Loop lendo os pacotes e colando no novo arquivo
      for await (const packet of sink.packets()) {
        // Clonamos o pacote da memória apenas ajustando o carimbo de tempo para dar continuidade
        const adjustedTimestamp = globalTimestamp + packet.timestamp;
        const adjustedPacket = packet.clone({ timestamp: adjustedTimestamp });

        // Adicionamos diretamente à fonte de gravação (sem uso de CPU para re-encode)
        await packetSource.add(adjustedPacket);
      }

      // Avançamos o tempo global para que o próximo arquivo comece onde este terminou
      globalTimestamp += duration;
    } finally {
      // Clean Code: O Input mantem um ponteiro aberto no disco.
      // O bloco finally garante que seja fechado (evitando memory leaks no Node.js)
      input.dispose();
    }
  }

  // 5. Sinaliza que acabaram os pacotes de áudio e finaliza a gravação do contêiner no disco
  packetSource.close();
  await outputMuxer.finalize();

  console.log(`✅ Sucesso! Áudios mesclados e salvos em: ${outputPath}`);
}

// Executando
mergeMp3Files(INPUT_FILES, OUTPUT_FILE).catch(console.error);
