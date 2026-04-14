# Auto Story

Transforme textos em vídeos narrados, com imagens geradas por IA, áudio profissional e trilha sonora.

## O que é

Você escreve ou cola um roteiro. O Auto Story transforma esse roteiro em um vídeo completo: cenas ilustradas, narração com voz sintética, legendas sincronizadas e música de fundo. Tudo gerado automaticamente. No final, você baixa o vídeo pronto e todos os arquivos individuais (imagens, áudios, transcrições).

## Como funciona

O processo passa por 4 etapas, em sequência:

**1. Roteiro** — Você escreve ou cola o texto da sua história. Pode ser um conto, um roteiro de vídeo, um capítulo de livro, qualquer coisa. Também escolhe o idioma (português, inglês ou espanhol), o estilo visual e a voz do narrador.

**2. Geração** — O sistema divide o texto em cenas e, para cada cena, gera:
- Uma imagem no estilo que você escolheu
- A narração em áudio com a voz selecionada
- Legendas sincronizadas com a fala
- Música de fundo (opcional)

**3. Montagem** — Todas as cenas são montadas em sequência com transições, formando o vídeo final.

**4. Exportação** — Você assiste ao preview e baixa um pacote ZIP com o vídeo MP4, as imagens, os áudios, as legendas e os metadados do projeto.

## Modos de criação

Existem 4 formas de começar um projeto:

| Modo | Quando usar |
|------|-------------|
| **História simples** | Você tem um texto e quer transformar em vídeo narrado com imagens |
| **Com comentarista** | Mesmo que o anterior, mas com um personagem extra que comenta a história (como um narrador-espectador com personalidade própria) |
| **História em vídeo** | Em vez de imagens estáticas, cada cena vira um clipe de vídeo gerado por IA |
| **A partir de áudio** | Você já tem uma gravação de áudio (podcast, narração, entrevista). Faz o upload e o sistema transforma em vídeo |

## Funcionalidades

- **3 idiomas** — Português, inglês e espanhol
- **Várias vozes** — Escolha entre dezenas de vozes sintéticas
- **Estilo visual** — Defina o estilo das imagens (realista, desenho, pintura, etc.)
- **Consistência de personagens** — Mantém a aparência dos personagens consistente entre cenas
- **Música de fundo** — Gerada automaticamente no estilo da história
- **Comentarista** — Adiciona um personagem que comenta a história com voz e personalidade próprias
- **Clipes de vídeo** — Em vez de imagens estáticas, gera vídeos curtos por cena
- **Pacote completo** — Exporta tudo: vídeo, imagens, áudios, legendas e dados do projeto

## Começando

### Pré-requisitos

- Node.js 18+
- npm, yarn, pnpm ou bun

### Instalação

```bash
# Clone o repositório
git clone <url-do-repo>
cd auto-story

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env.local
```

Edite o `.env.local` com suas chaves de API (serviços de IA para geração de imagens, áudio e vídeo).

### Rodando

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### Build para produção

```bash
npm run build
npm start
```
