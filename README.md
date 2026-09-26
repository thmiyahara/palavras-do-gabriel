# Palavras do Gabriel

Joguinho para aprender as primeiras palavras em **português, inglês e japonês**.
A criança toca num desenho, o cartão faz uma animação e o app fala o nome no idioma escolhido.
Tem dois modos:

- **Explorar** – 157 palavras em 12 categorias (pessoas, animais, comida, corpo, roupas, casa, veículos, natureza, sentimentos, cores, formas, números). Tocar = ouvir a palavra.
- **Quiz** – "Cadê o cachorro?" O app fala e a criança toca no desenho certo. Acertou: festa de confete e estrelinha. Errou: o cartão errado some, sem som negativo.

O botão 🌐 fala as três línguas em sequência (pt → en → ja).

É um **PWA** (Progressive Web App): abre no navegador e pode ser instalado na tela inicial do celular ou tablet, funcionando offline depois da primeira abertura.

## Rodar no computador

```bash
npm install
npm run dev
```

Abra `http://localhost:5173/palavras-do-gabriel/`.

Para testar num tablet na mesma rede Wi-Fi (sem instalar, só o app aberto no navegador):

```bash
npm run build
npm run preview -- --host
```

e abra no tablet o endereço `http://<IP-do-computador>:4173/palavras-do-gabriel/`.

## Publicar (GitHub Pages)

A instalação no celular exige HTTPS, por isso o app precisa estar publicado.

1. Crie um repositório **vazio** chamado `palavras-do-gabriel` no GitHub (público).
2. No computador:
   ```bash
   git remote add origin https://github.com/<seu-usuario>/palavras-do-gabriel.git
   git push -u origin main
   ```
3. No GitHub: **Settings → Pages → Source: GitHub Actions**.
4. A cada `git push`, o workflow em `.github/workflows/deploy.yml` publica o site em
   `https://<seu-usuario>.github.io/palavras-do-gabriel/`.

Se o repositório tiver outro nome, ajuste `base` em `vite.config.ts`.
Para publicar na raiz de um domínio (Netlify, Vercel…), gere com `BASE_PATH=/ npm run build` e envie a pasta `dist/`.

## Instalar no celular ou tablet

- **Android (Chrome)**: abra o endereço publicado → menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone/iPad (Safari)**: abra o endereço → botão **Compartilhar** → **Adicionar à Tela de Início**.

Depois da primeira abertura online, todas as imagens e áudios ficam guardados no aparelho e o app funciona sem internet.

## Mudar ou acrescentar palavras

Toda a lista fica em `data/words.json` (palavra, pergunta do quiz, kana/kanji/romaji e o nome da pasta do emoji no repositório do Fluent Emoji).

```bash
npm run fetch:emoji   # baixa os desenhos que faltam para public/img/
npm run gen:audio     # gera os áudios que faltam em public/audio/ (precisa de python -m pip install -U edge-tts)
```

Os dois scripts só geram o que ainda não existe; para regravar uma palavra, apague o MP3 correspondente e rode de novo.

Vozes usadas (Microsoft Edge neural, via `edge-tts`): `pt-BR-FranciscaNeural`, `en-US-JennyNeural`, `ja-JP-NanamiNeural`. Para trocar, edite `VOICES` em `scripts/gen-audio.py`.

## Créditos

- Desenhos: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (Microsoft, licença MIT).
- Bandeiras: [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0).
- Vozes: geradas com [edge-tts](https://github.com/rany2/edge-tts).
