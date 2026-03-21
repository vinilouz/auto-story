como vejo os stages:
* form: 
   * input -> recebe dados do form e aparecem inputs de acordo com o flow escolhido. 
   * output: cria e salva os dados em json no arquivo de story
* audio:
   * I: recebe long text (string) e faz request
   * O: pega retorno da requests, salva localmente, retorna path local do mp3 apos salvar no arquivo da story.
* transcription:
   * I: array de paths de audios locais, concatena com media bunny (sempre refaz quando é pedido transcription) e faz request com audio concatenado
   * O: salva retorno da transcription em arquivo transcription.json em formato esperado do remotion (acredito que é startMs e endMs mas vale revisar). salva no aquivo da story o path da transcrição
* description
   * I: recebe array no formato `[ { text: "bla bla" }, { text: "e o bla bla continua" }, { text: "finalmente o fim" } ] e faz request com esse array nesse exato formato e adicionando o pre-prompt/sys-prompt necessario`
   * O: retorna no mesmo formato [ { visual: "bla bla" }, { visual: "e o bla bla continua" }, { visual: "finalmente o fim" } ] correspondendo index para cada uma das cenas. salva no aquivo da story
* Images:
   * I: monta prompt com mesma função de pre-prompt que deve existir para formar `$style \n $visualDescription` e fazer a request de imagem. NOTA: Se consistency=true deve ter a imagem da entidade ou entidades na request tambem.
   * O: salva a imagem retorno e retorna o path para o arquivo onde os dados ficam salvos
* clips:
   * i: recebe texto e image (optional)
   * o: recebe url de video, baixa, salva localmente, salva path no story.json
* Music: 
   * i: recebe roteiro completo e faz request de text usando pre-prompt devido para music, pega o retorno da request de text e usa na request de music
   * o: baixa o mp4 da url retorno (sempre vem como mp4), salva o path local no story json
* split
   * i: recebe metodo de divisao, sendo segundos ou caracteres
   * o: divide roteiro se por caracteres, se por tempo ve oq é falado dentro do tempo que deve ser dividido e cria as cenas com esse texto
* entities
   * i: recebe roteiro completo e faz request de text usando pre-prompt devido para extrair entities, pega o retorno da request de text que é um json com todas entidades e suas descrições e usa as descrições na request de images com o pre-prompt devido que faz `$style \n $visualEntityDescription`
   * o: retorna entities description e images
* Video:
   * I: confere se tem todos os dados necessario e monta preview de acordo com o flow selecionado
   * O: retorna o preview e botao com renderizar


Agora com essa explicação clara me diga como ter uma clean architecture e clean code.