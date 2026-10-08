import test from 'node:test';
import assert from 'node:assert/strict';
import { recorte, tamanhoSaida, formatoDeVideo, nomeDoArquivo } from '../../src/captura.js';
import { avaliarCaptura, montarCredito } from '../../src/captura-licenca.js';

test('recorte centralizado em cada proporção, sem esticar', () => {
  assert.deepEqual(recorte(1000, 800, '1:1'), { sx: 100, sy: 0, sw: 800, sh: 800 });
  assert.deepEqual(recorte(1000, 800, '16:9'), { sx: 0, sy: 119, sw: 1000, sh: 563 });
  const r = recorte(1000, 800, '9:16');
  assert.ok(Math.abs(r.sw / r.sh - 9 / 16) < 0.01 && r.sh === 800);
  const q = recorte(1000, 800, '4:5');
  assert.ok(Math.abs(q.sw / q.sh - 0.8) < 0.01);
  assert.deepEqual(recorte(500, 500, 'invalida'), { sx: 0, sy: 0, sw: 500, sh: 500 }); // proporção desconhecida cai para 1:1
});
test('tamanho de saída respeita o lado maior', () => {
  assert.deepEqual(tamanhoSaida('1:1', 1080), { w: 1080, h: 1080 });
  assert.deepEqual(tamanhoSaida('16:9', 1080), { w: 1080, h: 608 });
  assert.deepEqual(tamanhoSaida('9:16', 720), { w: 405, h: 720 });
});
test('formato de vídeo: primeiro suportado, ou null para o app avisar', () => {
  assert.equal(formatoDeVideo((t) => t === 'video/webm'), 'video/webm');
  assert.equal(formatoDeVideo((t) => t.startsWith('video/webm;codecs=vp9')), 'video/webm;codecs=vp9');
  assert.equal(formatoDeVideo(() => false), null);
  assert.equal(formatoDeVideo(() => { throw new Error('sem suporte'); }), null);
});
test('nome do arquivo sem dado pessoal', () => {
  const n = nomeDoArquivo('Luma', 'png', new Date('2026-10-08T14:03:09Z'));
  assert.equal(n, 'luma-20261008140309.png');
  assert.equal(nomeDoArquivo('Maria da Silva/../x', 'webm', new Date('2026-10-08T00:00:00Z')).includes('/'), false);
  assert.match(nomeDoArquivo('', 'png'), /^avatar-\d{14}\.png$/);
});

const modeloOk = { decisao: 'permitido', titulo: 'AvatarSample_A', autor: 'VRoid Project', licenca: 'Other', bloqueio: [], conferir: [] };
test('captura liberada: modelo permitido e clipe com licença que não proíbe o uso', () => {
  const r = avaliarCaptura({ modelo: modeloOk, clipe: { id: 'giro', origem: 'Pacote VRMA_MotionPack do VRoid Project (BOOTH)', licenca: 'Termos do pacote VRoid: uso livre e comercial com crédito; proibido redistribuir' } });
  assert.equal(r.ok, true);
  assert.match(r.credito, /AvatarSample_A, VRoid Project/);
  assert.match(r.credito, /Animação: Pacote VRMA_MotionPack/);
});
test('Mixamo: "proibido distribuir o arquivo solto" não bloqueia foto nem vídeo', () => {
  const r = avaliarCaptura({ modelo: modeloOk, clipe: { id: 'aceno', origem: 'Mixamo (Adobe)', licenca: 'Termos da Adobe/Mixamo: uso livre em projetos; proibido distribuir o arquivo solto' } });
  assert.equal(r.ok, true);
});
test('modelo bloqueado ou licença de clipe que proíbe o uso bloqueia a captura', () => {
  const bloq = avaliarCaptura({ modelo: { decisao: 'bloqueado', bloqueio: ['só o autor pode usar este avatar'], conferir: [] }, clipe: null });
  assert.equal(bloq.ok, false);
  assert.match(bloq.motivos.join(' '), /só o autor/);
  const clipe = avaliarCaptura({ modelo: modeloOk, clipe: { id: 'x', licenca: 'Uso proibido sem autorização escrita' } });
  assert.equal(clipe.ok, false);
  assert.equal(avaliarCaptura({ modelo: null, clipe: null }).ok, false);
});
test('modelo em "conferir" e clipe sem licença escrita pedem confirmação do dono', () => {
  const conf = { decisao: 'conferir', titulo: 'T', autor: 'A', licenca: 'CC_BY', bloqueio: [], conferir: ['uso comercial proibido: confirme que o evento não tem fins lucrativos'] };
  const r = avaliarCaptura({ modelo: conf, clipe: { id: 'giro', licenca: '' } });
  assert.equal(r.ok, false);
  assert.equal(r.conferir.length, 2);
  const depois = avaliarCaptura({ modelo: conf, clipe: { id: 'giro', licenca: '' }, confirmouModelo: true, confirmouClipe: true });
  assert.equal(depois.ok, true);
});
test('crédito: o idle não entra como animação, outros clipes sim', () => {
  assert.doesNotMatch(montarCredito(modeloOk, { id: 'idle' }), /Animação/);
  assert.match(montarCredito(modeloOk, { id: 'aceno', origem: 'Mixamo (Adobe)' }), /Animação: Mixamo/);
  assert.equal(montarCredito(null, null), '');
});
