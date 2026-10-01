// P7: licença lida no carregamento. Serve o mesmo .vrm com a meta alterada para "só o autor"
// (o arquivo em disco não muda) e confere que o app bloqueia e avisa. Depois confere o painel.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ARQ = 'assets/avatars/8590256991748008892.vrm';

// Reescreve o chunk JSON de um GLB, refazendo os tamanhos (alinhamento de 4 bytes com espaços).
function vrmComMeta(alterar) {
  const b = readFileSync(ARQ);
  const lenJson = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + lenJson).toString());
  alterar(json.extensions.VRM.meta);
  let novo = Buffer.from(JSON.stringify(json));
  if (novo.length % 4) novo = Buffer.concat([novo, Buffer.alloc(4 - (novo.length % 4), 0x20)]);
  const resto = b.subarray(20 + lenJson);
  const cab = Buffer.alloc(20);
  cab.writeUInt32LE(0x46546c67, 0); cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(20 + novo.length + resto.length, 8);
  cab.writeUInt32LE(novo.length, 12); cab.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([cab, novo, resto]);
}

async function abrir(page) {
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('prof3d_personagem', 'luma'); });
  await page.goto('/?debug');
}

test('P7: licença "só o autor" bloqueia o avatar e explica o motivo', async ({ page }) => {
  const corpo = vrmComMeta((m) => { m.allowedUserName = 'OnlyAuthor'; });
  await page.route('**/' + ARQ, (r) => r.fulfill({ status: 200, contentType: 'model/gltf-binary', body: corpo }));
  await abrir(page);
  await expect(page.locator('#erroAvatar')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#erroTitulo')).toHaveText('A licença do avatar de Luma não permite este uso.');
  await expect(page.locator('#erroMotivo')).toHaveText('Só o autor pode usar este avatar.');
  await expect(page.locator('#passo')).toBeHidden();
  expect(await page.evaluate(() => window.__prof3d.avatar)).toBe(null);
  await page.screenshot({ path: 'relatorios/p7-bloqueado.png' });
});

test('P7: licença válida carrega e aparece no painel', async ({ page }) => {
  await abrir(page);
  await page.waitForFunction(() => !!(window.__prof3d && window.__prof3d.avatar), null, { timeout: 60_000 });
  const lic = await page.evaluate(() => window.__prof3d.licencas.get('luma'));
  expect(lic.decisao).toBe('permitido');
  expect(lic.autor).toBe('VRoid Project');
  await page.click('#gear');
  await expect(page.locator('#listaLicencas')).toContainText('Luma: permitido');
  await expect(page.locator('#listaLicencas')).toContainText('AvatarSample_A | VRoid Project | VRM 0.x | Other');
});
