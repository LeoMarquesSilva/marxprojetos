# Reels · Portfólio INSYT

Vídeo 1080×1920 (9:16), 30 fps, ~53s, feito em [Remotion](https://www.remotion.dev)
(vídeo programático em React) com a identidade da INSYT: laranja `#f74211`,
navy `#0a0f2d`, Cabinet Grotesk + Poppins e o símbolo animado bloco a bloco.

## Roteiro

| Tempo | Cena | O que acontece |
|---|---|---|
| 0–5s | Gancho | "Antes de ligar, seu cliente pesquisa você." + busca digitando → "O que ele encontra?" |
| 5–8s | Marca | Símbolo INSYT se monta, wordmark, "Ideias que viram presença." |
| 8–38s | 7 projetos | Captura real de cada site rolando no notebook + celular |
| 38–41s | Mural | Todos os projetos juntos: "7 projetos. 1 especialidade: o jurídico." |
| 41–46s | Diferenciais | "Site bonito não basta." + 4 entregas |
| 46–53s | CTA | "Quer um site assim para o seu escritório?" → **Me chama na DM** / WhatsApp |

O conteúdo importante fica entre y=230 e y=1500, fora das áreas que a
interface do Reels cobre (topo, legenda embaixo e ícones à direita).

## Comandos

```bash
npm install
npm run capture        # recaptura os sites (precisa do Chrome instalado)
npm run studio         # preview interativo no navegador
npm run render         # gera out/insyt-portfolio-reel.mp4 (frames + codificação no Chrome)
node scripts/stills.mjs 0 300 900   # frames soltos em out/stills para revisão
```

- Projetos, textos e ordem: `src/projects.ts`
- Duração das cenas: `src/timeline.ts` (todo o resto se ajusta a partir dele)
- Cores e fontes: `src/theme.ts`

## Por que o render não usa `remotion render`

Nesta máquina o Smart App Control do Windows bloqueia o ffmpeg que vem com o
Remotion (DLLs não assinadas). `scripts/render.mts` contorna isso: o Remotion
renderiza os frames com o Chrome e o próprio Chrome codifica H.264 + AAC via
WebCodecs (Mediabunny), já mixando os efeitos sonoros. Em outra máquina,
`npx remotion render PortfolioReel` também funciona.

## Áudio

O vídeo sai só com efeitos sonoros (whooshes nos cortes, clique e "ding" no CTA).
A música entra pelo próprio Instagram: áudio em alta dá mais alcance e já vem
licenciado. Para anúncio, use uma faixa da biblioteca comercial do Meta
(Sound Collection), porque músicas populares do app não podem ser usadas em
anúncios.
