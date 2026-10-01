import { defineConfig } from '@playwright/test';

// Porta própria (8771) para não disputar com o servidor de desenvolvimento (8770).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8771',
    headless: true,
    launchOptions: {
      // GPU de verdade no Windows (D3D11). Com WebGL por software (SwiftShader) o render
      // a 60 fps come a CPU e o Kokoro local, que disputa a mesma CPU, fica 4x mais lento.
      args: [
        '--autoplay-policy=no-user-gesture-required',
        ...(process.platform === 'win32'
          ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
          : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      ],
    },
  },
  webServer: {
    command: 'python serve.py 8771',
    url: 'http://localhost:8771/index.html',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
