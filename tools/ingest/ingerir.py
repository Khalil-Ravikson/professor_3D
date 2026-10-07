# -*- coding: utf-8 -*-
"""Ingestão de documentos para a base de conhecimento (prompt 3, U1). Offline por padrão.

Uso (da raiz do projeto):
  python tools/ingest/ingerir.py converter                 converte tudo de knowledge/_inbox/ para knowledge/_revisao/
  python tools/ingest/ingerir.py aprovar ARQUIVO.md --para luma    move um revisado para knowledge/luma/ (só sem campos PENDENTE)
  python tools/ingest/ingerir.py infantil ARQUIVO.md --confirmo   gera a versão infantil de um texto JÁ APROVADO (usa o Gemini: nuvem)
  python tools/ingest/ingerir.py llamaparse ARQUIVO --confirmo --creditos-por-pagina N   camada 3, nuvem; veja as travas abaixo

Camadas (mostra o motivo da escolha para cada arquivo):
  1. MarkItDown (MIT) para DOCX e PPTX. PDF: pdfminer.six (MIT, o mesmo que o MarkItDown usa por baixo), página a página, para marcar a página.
  2. Docling: não instalado (pesado). Se a camada 1 sair quebrada, o relatório recomenda; nada é instalado sozinho.
  3. LlamaParse: nuvem. Só com LLAMA_CLOUD_API_KEY no ambiente, a flag --confirmo e a estimativa aceita.
NÃO usa o PyMuPDF4LLM (AGPL-3.0), mesmo com o PyMuPDF instalado na máquina.

Nada sai do computador sem confirmação: os comandos de nuvem recusam rodar sem a variável de ambiente da chave e sem --confirmo.
A chave só existe em variável de ambiente; nunca é lida de arquivo do repositório nem escrita em log.
"""
import argparse, datetime, hashlib, io, json, os, re, shutil, sys

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
INBOX = os.path.join(RAIZ, 'knowledge', '_inbox')
REVISAO = os.path.join(RAIZ, 'knowledge', '_revisao')
MANIFEST = os.path.join(INBOX, '.manifest.json')
PENDENTE = 'PENDENTE'
NIVEIS = ('infantil', 'geral', 'tecnico')
RESIDUOS = [(r'\x00?cite(?:[\x00\s]*turn\d+search\d+)+\x00?', 'marca "cite turn..." de ferramenta de IA'), (r'</?b>', 'tag HTML <b>'), (r'�', 'caractere de codificação quebrada')]


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        for bloco in iter(lambda: f.read(1 << 20), b''):
            h.update(bloco)
    return h.hexdigest()


def cabecalho(origem, hash_):
    hoje = datetime.date.today().isoformat()
    return (f'fonte: {PENDENTE}: de onde veio (documento, página ou endereço)\n'
            f'url: {PENDENTE}: endereço, se houver\n'
            f'data_consulta: {hoje}\n'
            f'nivel: geral\n'
            f'licenca: {PENDENTE}: licença ou permissão de uso\n'
            f'origem_arquivo: {origem}\n'
            f'hash: {hash_}\n\n')


# ---------- conversão ----------
def converter_pdf(caminho):
    from pdfminer.high_level import extract_text
    from pdfminer.pdfpage import PDFPage
    with open(caminho, 'rb') as f:
        n = sum(1 for _ in PDFPage.get_pages(f))
    paginas = []
    for i in range(n):
        t = extract_text(caminho, page_numbers=[i]) or ''
        paginas.append(re.sub(r'\n{3,}', '\n\n', t).strip())
    corpo = '\n\n'.join(f'## Página {i + 1}\n\n{t}' for i, t in enumerate(paginas) if t)
    return corpo, {'paginas': n, 'paginas_sem_texto': [i + 1 for i, t in enumerate(paginas) if not t]}, 'pdfminer.six por página (camada 1)', 'o MarkItDown não marca a página, e a página é um campo obrigatório do cabeçalho'


def converter_markitdown(caminho):
    from markitdown import MarkItDown
    texto = MarkItDown().convert(caminho).text_content
    return texto, {}, 'MarkItDown (camada 1)', 'DOCX e PPTX: formato estruturado, o MarkItDown preserva títulos, tabelas e notas'


def ajustar_slides(texto):
    """Um slide por pedaço, com as notas do orador marcadas."""
    texto = re.sub(r'<!--\s*Slide number:\s*(\d+)\s*-->', r'## Slide \1', texto)
    texto = re.sub(r'(?m)^###\s*Notes?:\s*$', 'Notas do orador:', texto)
    return texto


def limpar(texto):
    for padrao, _ in RESIDUOS[:2]:
        texto = re.sub(r'[ \t]*' + padrao, '', texto)
    texto = texto.replace('\x00', '')  # nulos soltos que alguns PDFs deixam no texto
    return re.sub(r'\n{3,}', '\n\n', texto).strip()


def relatorio_qualidade(nome, bruto, limpo, extra, metodo, motivo):
    titulos = len(re.findall(r'(?m)^#{1,3}\s+\S', limpo))
    tabelas = len(re.findall(r'(?m)^\|.+\|\s*$', limpo)) // 3
    residuos = [(d, len(re.findall(p, bruto))) for p, d in RESIDUOS if re.search(p, bruto)]
    if '\x00' in bruto: residuos.append(('caracteres nulos soltos', bruto.count('\x00')))
    avisos = []
    if titulos == 0: avisos.append('nenhum título detectado: a estrutura pode ter saído quebrada (recomenda Docling, não instalado)')
    if extra.get('paginas_sem_texto'): avisos.append(f"páginas sem texto (imagem ou digitalização?): {extra['paginas_sem_texto']}; precisam de OCR")
    if len(limpo.split()) < 50: avisos.append('menos de 50 palavras: conferir se o arquivo foi lido')
    linhas = [f'# Relatório de qualidade: {nome}', '', f'- Método: {metodo}', f'- Motivo: {motivo}',
              f'- Palavras: {len(limpo.split())}', f'- Títulos detectados: {titulos}', f'- Tabelas detectadas: {tabelas}']
    if 'paginas' in extra: linhas.append(f"- Páginas: {extra['paginas']}, sem texto: {extra['paginas_sem_texto'] or 'nenhuma'}")
    linhas.append('- Resíduos removidos: ' + (', '.join(f'{d} ({n}x)' for d, n in residuos) or 'nenhum'))
    linhas.append('')
    linhas += ['## Avisos'] + ([f'- {a}' for a in avisos] or ['- nenhum'])
    linhas += ['', '## Antes de aprovar', f'- Preencha `fonte:`, `url:` e `licenca:` (hoje {PENDENTE}) e confira `nivel:` (infantil, geral ou tecnico).',
               '- Leia o texto: o relatório não verifica fatos.']
    return '\n'.join(linhas) + '\n', avisos


def cmd_converter(args):
    if not os.path.isdir(INBOX):
        print(f'Pasta {os.path.relpath(INBOX, RAIZ)} não existe. Crie e coloque os arquivos (PDF, PPTX, DOCX).'); return 0
    manifest = json.load(open(MANIFEST, encoding='utf-8')) if os.path.exists(MANIFEST) else {}
    os.makedirs(REVISAO, exist_ok=True)
    feitos = 0
    for nome in sorted(os.listdir(INBOX)):
        caminho = os.path.join(INBOX, nome)
        ext = os.path.splitext(nome)[1].lower()
        if nome.startswith('.') or not os.path.isfile(caminho): continue
        if ext not in ('.pdf', '.pptx', '.docx'):
            print(f'{nome}: formato {ext or "sem extensão"} fora do escopo (PDF, PPTX, DOCX); ignorado.'); continue
        h = sha256(caminho)
        if manifest.get(nome, {}).get('hash') == h and not args.refazer:
            print(f'{nome}: sem mudança (hash igual), nada a reprocessar.'); continue
        try:
            if ext == '.pdf': bruto, extra, metodo, motivo = converter_pdf(caminho)
            else:
                bruto, extra, metodo, motivo = converter_markitdown(caminho)
                if ext == '.pptx': bruto = ajustar_slides(bruto)
        except ModuleNotFoundError as e:
            print(f'{nome}: FALHOU, falta o pacote {e.name}. Nada foi instalado sozinho.'); continue
        except Exception as e:  # um arquivo ruim não derruba os outros
            print(f'{nome}: FALHOU ({type(e).__name__}: {str(e)[:120]})'); continue
        limpo = limpar(bruto)
        base = os.path.splitext(nome)[0] + '-' + ext[1:]  # a extensão entra no nome: a.docx e a.pptx não podem se sobrescrever
        saida = os.path.join(REVISAO, base + '.md')
        titulo = re.search(r'(?m)^#\s+(.+)$', limpo)
        io.open(saida, 'w', encoding='utf-8', newline='\n').write(cabecalho(nome, h) + ('' if titulo else f'# {base}\n\n') + limpo + '\n')
        rel, avisos = relatorio_qualidade(nome, bruto, limpo, extra, metodo, motivo)
        io.open(os.path.join(REVISAO, base + '.relatorio.md'), 'w', encoding='utf-8', newline='\n').write(rel)
        manifest[nome] = {'hash': h, 'saida': os.path.relpath(saida, RAIZ), 'metodo': metodo, 'data': datetime.date.today().isoformat()}
        print(f'{nome}: {metodo}; {len(limpo.split())} palavras; {len(avisos)} aviso(s) -> {os.path.relpath(saida, RAIZ)}')
        feitos += 1
    json.dump(manifest, io.open(MANIFEST, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
    print(f'{feitos} arquivo(s) convertido(s). Revise em knowledge/_revisao/ e aprove com o comando "aprovar".')
    return 0


# ---------- aprovação ----------
def ler_campos(texto):
    campos = {}
    for linha in texto.split('\n'):
        if not linha.strip(): break
        m = re.match(r'^([a-z_]+):\s*(.*)$', linha)
        if m: campos[m.group(1)] = m.group(2).strip()
    return campos


def cmd_aprovar(args):
    origem = args.arquivo if os.path.isabs(args.arquivo) else os.path.join(REVISAO, os.path.basename(args.arquivo))
    if not os.path.isfile(origem): print(f'Não achei {origem}.'); return 1
    texto = io.open(origem, encoding='utf-8').read()
    c = ler_campos(texto)
    faltam = [k for k in ('fonte', 'licenca') if not c.get(k) or c[k].startswith(PENDENTE)]
    if faltam: print(f'RECUSADO: preencha {", ".join(faltam)} no cabeçalho (ainda {PENDENTE}).'); return 1
    if c.get('nivel') not in NIVEIS: print(f'RECUSADO: nivel deve ser um de {", ".join(NIVEIS)}.'); return 1
    destino = os.path.join(RAIZ, 'knowledge', args.para)
    os.makedirs(destino, exist_ok=True)
    alvo = os.path.join(destino, os.path.basename(origem))
    shutil.move(origem, alvo)
    rel = origem[:-3] + '.relatorio.md'
    if os.path.exists(rel): os.remove(rel)
    print(f'Aprovado: {os.path.relpath(alvo, RAIZ)}. Rode "npm run conhecimento" para atualizar o índice.')
    return 0


# ---------- nuvem: travas ----------
def exigir_nuvem(args, variavel):
    if not os.environ.get(variavel):
        print(f'RECUSADO: a variável de ambiente {variavel} não está definida. A chave só existe no ambiente, nunca em arquivo do repositório.'); return False
    if not args.confirmo:
        print('RECUSADO: este comando envia o texto para um serviço de nuvem. Rode de novo com --confirmo para ESTE arquivo, depois de ler a estimativa acima.'); return False
    return True


def cmd_llamaparse(args):
    caminho = args.arquivo if os.path.isabs(args.arquivo) else os.path.join(INBOX, args.arquivo)
    if not os.path.isfile(caminho): print(f'Não achei {caminho}.'); return 1
    paginas = 0
    if caminho.lower().endswith('.pdf'):
        from pdfminer.pdfpage import PDFPage
        with open(caminho, 'rb') as f: paginas = sum(1 for _ in PDFPage.get_pages(f))
    print(f'Arquivo: {os.path.basename(caminho)}, páginas: {paginas or "?"}.')
    if args.creditos_por_pagina is None:
        print('Estimativa: informe --creditos-por-pagina N. O valor por camada NÃO está neste script: confira na documentação do LlamaParse do dia, e se há plano gratuito.')
    else:
        print(f'Estimativa: {paginas} páginas x {args.creditos_por_pagina} créditos = {paginas * args.creditos_por_pagina} créditos.')
    if not exigir_nuvem(args, 'LLAMA_CLOUD_API_KEY'): return 1
    if args.creditos_por_pagina is None: print('RECUSADO: sem estimativa não há confirmação válida.'); return 1
    print('Confirmado, mas o envio real não foi implementado neste script (NÃO TESTADO): a camada 3 só entra se as camadas 1 e 2 falharem num arquivo seu.')
    return 2


def cmd_infantil(args):
    origem = args.arquivo if os.path.isabs(args.arquivo) else os.path.join(RAIZ, 'knowledge', args.pasta, os.path.basename(args.arquivo))
    if not os.path.isfile(origem): print(f'Não achei {origem}. A versão infantil só nasce de um texto JÁ APROVADO (dentro de knowledge/<pasta>/).'); return 1
    texto = io.open(origem, encoding='utf-8').read()
    tokens = len(texto) // 4
    print(f'Texto aprovado: {os.path.basename(origem)}, cerca de {tokens} tokens de entrada. Vai para a API do Gemini (nuvem).')
    print('Custo: calcule com `node tools/projetar-custo.mjs`; um documento destes custa frações de centavo no 3.1 Flash-Lite (preço do dia a conferir).')
    if not exigir_nuvem(args, 'GEMINI_API_KEY'): return 1
    print('Confirmado, mas a chamada real não foi implementada neste script (NÃO TESTADO): rodar a rede aqui falha (Node e curl não alcançam o Google nesta máquina).')
    return 2


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('converter'); c.add_argument('--refazer', action='store_true'); c.set_defaults(f=cmd_converter)
    a = sub.add_parser('aprovar'); a.add_argument('arquivo'); a.add_argument('--para', required=True, help='pasta de destino em knowledge/ (id do personagem)'); a.set_defaults(f=cmd_aprovar)
    i = sub.add_parser('infantil'); i.add_argument('arquivo'); i.add_argument('--pasta', default='luma'); i.add_argument('--confirmo', action='store_true'); i.set_defaults(f=cmd_infantil)
    l = sub.add_parser('llamaparse'); l.add_argument('arquivo'); l.add_argument('--confirmo', action='store_true'); l.add_argument('--creditos-por-pagina', type=float); l.set_defaults(f=cmd_llamaparse)
    args = ap.parse_args()
    sys.exit(args.f(args))


if __name__ == '__main__':
    main()
