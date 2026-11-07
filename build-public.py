"""公開物だけを出力する。入力済み記録・機体実績・ローカル原本は配信しない。"""
from pathlib import Path
import shutil
ROOT = Path(__file__).resolve().parent
FILES = ['index.html', 'records.html', 'records.css', 'records-core.js', 'records.js',
         'workflow-core.js', 'workflow.js', 'workflow.css', 'mobile.js', 'sw.js',
         'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png']
if __name__ == '__main__':
    output = ROOT / 'public-dist'
    output.mkdir(exist_ok=True)
    if set(p.name for p in output.iterdir()) - set(FILES + ['workflow-data.js', '.nojekyll']):
        raise SystemExit('公開先に想定外のファイルがあります。混入を防ぐため停止します。')
    for name in FILES:
        shutil.copy2(ROOT / name, output / name)
    shutil.copy2(ROOT / 'workflow-public-data.js', output / 'workflow-data.js')
    (output / '.nojekyll').touch()
    print(output)
