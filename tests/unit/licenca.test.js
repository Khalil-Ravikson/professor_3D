import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarLicenca, licencaDependenciaProblematica } from '../../src/licenca.js';

const HUB = 'https://hub.vroid.com/license?allowed_to_use_user=everyone&corporate_commercial_use=allow&credit=unnecessary&redistribution=allow';

test('sample do VRoid Hub (VRM 0.x, Other com URL do Hub) é permitido', () => {
  const r = avaliarLicenca({ title: 'AvatarSample_A', author: 'VRoid Project', allowedUserName: 'Everyone', commercialUssageName: 'Allow', licenseName: 'Other', otherLicenseUrl: HUB });
  assert.equal(r.decisao, 'permitido');
  assert.equal(r.autor, 'VRoid Project');
  assert.equal(r.versao, '0.x');
});

test('CC0 é permitido', () => {
  assert.equal(avaliarLicenca({ allowedUserName: 'Everyone', commercialUssageName: 'Allow', licenseName: 'CC0' }).decisao, 'permitido');
});

test('só o autor ou redistribuição proibida bloqueiam', () => {
  assert.equal(avaliarLicenca({ allowedUserName: 'OnlyAuthor', licenseName: 'CC0' }).decisao, 'bloqueado');
  assert.equal(avaliarLicenca({ allowedUserName: 'Everyone', licenseName: 'Redistribution_Prohibited' }).decisao, 'bloqueado');
  assert.equal(avaliarLicenca({ allowedUserName: 'Everyone', licenseName: 'Other', otherLicenseUrl: HUB.replace('redistribution=allow', 'redistribution=disallow') }).decisao, 'bloqueado');
});

test('casos duvidosos pedem conferência, sem bloquear', () => {
  const r = avaliarLicenca({ allowedUserName: 'Everyone', commercialUssageName: 'Disallow', licenseName: 'CC_BY_NC' });
  assert.equal(r.decisao, 'conferir');
  assert.ok(r.conferir.some((m) => /comercial/.test(m)));
  assert.equal(avaliarLicenca({ allowedUserName: 'Everyone', licenseName: 'Other', otherLicenseUrl: 'https://exemplo.com/licenca' }).decisao, 'conferir');
});

test('VRM 1.0: permissões e redistribuição', () => {
  assert.equal(avaliarLicenca({ metaVersion: '1', name: 'X', authors: ['A'], avatarPermission: 'everyone', commercialUsage: 'corporation', allowRedistribution: true }).decisao, 'permitido');
  assert.equal(avaliarLicenca({ metaVersion: '1', avatarPermission: 'onlyAuthor', allowRedistribution: true }).decisao, 'bloqueado');
  assert.equal(avaliarLicenca({ metaVersion: '1', avatarPermission: 'everyone', allowRedistribution: false }).decisao, 'bloqueado');
  assert.equal(avaliarLicenca({ metaVersion: '1', avatarPermission: 'everyone', commercialUsage: 'personalNonProfit', allowRedistribution: true }).decisao, 'conferir');
});

test('sem metadados bloqueia', () => {
  assert.equal(avaliarLicenca(null).decisao, 'bloqueado');
});

test('dependências: AGPL e GPL acusadas, MIT e Apache não, LGPL não confunde', () => {
  assert.match(licencaDependenciaProblematica('AGPL-3.0'), /AGPL/);
  assert.match(licencaDependenciaProblematica('GPL-3.0'), /GPL/);
  assert.equal(licencaDependenciaProblematica('MIT'), null);
  assert.equal(licencaDependenciaProblematica('Apache-2.0'), null);
  assert.equal(licencaDependenciaProblematica('LGPL-3.0'), null);
  assert.match(licencaDependenciaProblematica(''), /desconhecida/);
});
