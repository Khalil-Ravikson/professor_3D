# Proposta de ajustes na skill `vrm-avatar-web`

Para você aprovar antes de eu mexer em qualquer arquivo da skill. Nada foi alterado.

Tudo abaixo foi aprendido rodando o projeto, e cada item aponta onde está a evidência.

1. **Idle não é lacuna.** O `idle_loop.vrma` do ChatVRM é laço perfeito (primeiro e último quadro iguais, quadril desloca 1,7 cm). A tabela 25.6 do REPERTORIO dava repouso como lacuna e estava errada. A skill deve mandar conferir o laço medindo, não assumir.
2. **Fixar no lugar.** Clipe de Mixamo e do pacote VRoid desloca o quadril (VRMA_02 saía 0,335 m). Prender o quadril no X/Z do primeiro quadro do idle, deixando altura e rotação livres, resolveu. Usar `normalizedRestPose` quebrava o lookAt nos VRM 0.x.
3. **VRM 0.x e 1.0 têm metadados diferentes.** A licença está em campos diferentes (`licenseName`/`otherLicenseUrl` contra `licenseUrl`/`avatarPermission`). Ver `src/licenca.js`.
4. **Gesto do LLM vai como marca dentro da sentença** (`[gesto:nome]`) e começa quando a sentença começa a tocar. O intervalo mínimo conta do fim do gesto, não do início: contando do início, o aceno de 4,7 s fazia o gesto seguinte cair sempre.
5. **Medir mão na frente do rosto pela distância pulso a cabeça não funciona.** O aceno e o sinal de paz deram valores parecidos nos cinco modelos. Só a prévia no enquadramento do app mostra o problema. Folha de contato em corpo inteiro esconde o defeito.
6. **`waitForFunction` devolvendo objeto vira handle.** Na medição de memória, o DevTools segurava cada avatar antigo e o número de 10 trocas saiu falso (58 MB). Usar `!!` no retorno.
7. **Perda de contexto WebGL.** `preventDefault()` no `webglcontextlost` é obrigatório para o navegador tentar restaurar. Ao restaurar, o modelo precisa ser remontado do zero (texturas e geometrias foram para o lixo) e o relógio zerado para não dar salto de animação.
8. **`setTargetAtTime` não chega a zero.** Para mudo de áudio usar rampa linear: a exponencial deixa um fio de som.
9. **Contraste das paletas.** Branco sobre a cor de ação dava 4,27:1 na Luma e 2,73:1 no Teo. Cada paleta deve declarar a cor de texto que contrasta com a sua cor de ação.
10. **Geometrias e texturas mudam de modelo para modelo** (Luma 7/17, Rafa 2/4, Teo e Nina 1/3). Contador baixo depois de trocar de personagem não é vazamento.

Responda "aprovo" (todos) ou diga os números que quer.
