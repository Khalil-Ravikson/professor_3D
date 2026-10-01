"""Servidor estático para desenvolvimento: igual a `python -m http.server`,
mas manda Cache-Control: no-store. Sem isso o navegador reaproveita módulos
.js antigos depois de uma edição.

Uso: python serve.py [porta]   (padrão 8770, só em 127.0.0.1)
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SemCache(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".vrm": "model/gltf-binary", ".vrma": "model/gltf-binary"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    raiz = Path(__file__).resolve().parent
    servidor = ThreadingHTTPServer(("127.0.0.1", porta), partial(SemCache, directory=str(raiz)))
    print(f"Servindo {raiz} em http://localhost:{porta}")
    servidor.serve_forever()
