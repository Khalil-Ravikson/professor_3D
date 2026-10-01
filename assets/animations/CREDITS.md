# Créditos das animações e do perfil de lip sync

| Arquivo | Origem | Licença | SHA-256 |
|---|---|---|---|
| `animations/idle.vrma` | `public/idle_loop.vrma` de github.com/pixiv/ChatVRM (© 2023 pixiv Inc.) | MIT (licença do repositório) | ace95ba6dcc0bdf2ed1081c002332b4184441117c8d543b6f642b3d2c5cf99be |
| `lipsync/profile.json` | `example/profile.json` de github.com/mrxz/wLipSync (perfil de exemplo do uLipSync, © 2021 hecomi) | MIT | 4ee3af43fe3c9c47f4af50dd08df15400ca5b7ff0779b5dd2e68f00cebbacade |

Baixados em 30/09/2026.

## Animações que faltam (`talk`, `think`, `greet`)

Enquanto não existirem, esses estados usam o `idle`.

- **greet:** o pacote gratuito de 7 VRMA do VRoid Project (BOOTH) tem "Greeting" (`VRMA_02.vrma`). Os termos permitem uso pessoal e comercial **com crédito** ("Animation credits to pixiv Inc.'s VRoid Project"), mas **proíbem redistribuir** os arquivos. Então:
  1. baixe na BOOTH com a sua conta;
  2. salve como `assets/animations/greet.vrma`;
  3. **não commite** o arquivo (ponha no `.gitignore`);
  4. acrescente `greet: 'greet'` em `animacoes` do personagem, em `src/characters.js`.
- **talk / think:** não há VRMA gratuito com licença clara para esses dois. Um caminho é o Mixamo ("Talking", "Thinking", conta Adobe), convertido para VRMA com um conversor FBX→VRMA. A licença do Mixamo permite usar em projetos, mas não redistribuir os arquivos soltos.

## Pacote VRMA_MotionPack do VRoid Project (desde 01/10/2026)

Pasta `VRMA_MotionPack/VRMA_MotionPack/vrma/` (no `.gitignore`: o readme proíbe redistribuir). Cada pessoa baixa o seu na BOOTH.
Frase de crédito exigida pelo readme para uso comercial: **"Animation credits to pixiv Inc.'s VRoid Project"** (em japonês: キャラクターアニメーション: ピクシブ株式会社 VRoidプロジェクト).

| Arquivo | Nome no readme | O que se vê (folha de contato) | id no catálogo | SHA-256 |
|---|---|---|---|---|
| VRMA_01.vrma | Show full body | abre os braços e dá uma volta de 360 graus | mostrar-corpo | f45abc44800c647fa106537a2e31a84cb83b74cf3dd8a0ee71c6915f1555ac57 |
| VRMA_02.vrma | Greeting | sai agachada, levanta acenando, termina acenando | cumprimento-agachado | 6322bbe2df7716529dd53e2a61816e67b946416d3761c672b8d50ee2829825bb |
| VRMA_03.vrma | Peace sign | sinal com os dedos perto do rosto | sinal-paz | 6f66b6b5c0214a7b825498050380ea43a3f782b5ea24ce46f7096acf15866d75 |
| VRMA_04.vrma | Shoot | mão à cabeça com indicador estendido, depois aponta | dedo-arma | c40c1a7b0dbcac5aa9582f45498474255e4b0ca5642a71ffaf43878c27bedf70 |
| VRMA_05.vrma | Spin | braços abertos, gira 360 graus | giro | cc508712ca4db8833ffe982d2eecd427e9374a04c005db2a7a45775f0ca45586 |
| VRMA_06.vrma | Model pose | de lado, mão na cintura | pose-modelo | a2c86633690e911cf935c5b8cae6553aea0445567f88c2861f7597fc1bf08af1 |
| VRMA_07.vrma | Squat | agacha 23 cm e levanta | agachar | b0096525231e9f49947a6fad0295575b1c2bfbc33c042d07f125c7c2fbe88995 |

Neste pacote, a numeração do readme bateu com o que se vê.

## Aceno do Mixamo (01/10/2026)

| Arquivo | Origem | Licença | SHA-256 |
|---|---|---|---|
| `aceno.fbx` | Mixamo (Adobe), baixado pelo dono | Termos da Adobe: uso livre em projetos, proibido distribuir o arquivo solto. No `.gitignore` | 959ca03e099f837ad479cf3970690e5ea5dee40bd9242bb7b49c9020f90aa02e |
| `aceno.vrma` | convertido do `aceno.fbx` com fbx2vrma-converter (MIT, commit c645441) + FBX2glTF v0.9.7 | mesma do FBX. No `.gitignore` | 6c480fc38f088e0bcbfaf6d79055d1f42ac667ed3c73fca81e5ce996d86ac058 |
| `aceno2.fbx` | Mixamo (Adobe), baixado pelo dono (versão longa) | Termos da Adobe, como acima. No `.gitignore` | f4ec1adfec2c8be0701d748a79872f9c167004363aef1506170ef616f77d7247 |
| `aceno2.vrma` | convertido do `aceno2.fbx`, mesmo conversor | mesma do FBX. No `.gitignore` | acdf3c21897fef18adba112f19974076c5363734ec0faec023545f542b4d2aa0 |
