"""端末内だけで使う防除ツールの静的サーバー。入力データはブラウザに保存する。"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
FILES = {'index.html','styles.css','script.js','potash-guide.html','manifest.webmanifest','sw.js','records.html','records.css','records.js','records-core.js','workflow-core.js','workflow.js','workflow.css','workflow-data.js','mobile.js','icon-180.png','icon-192.png','icon-512.png'}
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT),**kwargs)
    def do_GET(self):
        path=self.path.split('?',1)[0]
        if path=='/.flight-records-health':
            self.send_response(200);self.end_headers();self.wfile.write(b'kurien-flight-records-local-v1');return
        if path=='/':self.path='/records.html'
        elif path.lstrip('/') not in FILES:self.send_error(404);return
        if self.path.split('?',1)[0]=='/workflow-data.js' and not (ROOT/'workflow-data.js').exists():self.path='/workflow-public-data.js'
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--no-open',action='store_true');parser.add_argument('--port',type=int,default=8769);args=parser.parse_args()
    url=f'http://127.0.0.1:{args.port}/records.html'
    try: server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    except OSError:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{args.port}/.flight-records-health',timeout=2) as r:
                if r.read()!=b'kurien-flight-records-local-v1':raise RuntimeError('別のプログラムがポートを使用しています')
        except Exception as e:raise SystemExit(f'起動できません。ポート{args.port}を確認してください：{e}')
        if not args.no_open:webbrowser.open(url)
        print('起動済みです：'+url)
        raise SystemExit(0)
    print('散布チェック・設定履歴：'+url,flush=True)
    print('このターミナルを閉じると停止します。停止はControl+C。',flush=True)
    if not args.no_open:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
