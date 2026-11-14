"""Extract the offline lookup table from a jmdict-simplified English JSON ZIP."""
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile

pairs = {}
with ZipFile(sys.argv[1]) as archive, archive.open(archive.namelist()[0]) as stream:
    for line in stream:
        if not line.startswith(b'{"id":'):
            continue
        word, _ = json.JSONDecoder().raw_decode(line.decode('utf-8'))
        if word['kanji']:
            continue
        for sense in word['sense']:
            sources = sense['languageSource']
            terms = [s['text'] for s in sources if s['lang'] == 'eng' and s['full'] and not s['wasei']]
            # A single unqualified gloss is a search hint, not proof of etymology.
            if not sources and len(word['sense']) == 1 and len(sense['gloss']) == 1:
                gloss = sense['gloss'][0]
                if not gloss['type'] and not sense['misc']:
                    terms = [gloss['text']]
            for kana in word['kana']:
                name = kana['text']
                if not re.fullmatch(r'[ァ-ヺー・]{2,48}', name) or kana['tags']:
                    continue
                if '*' not in sense['appliesToKana'] and name not in sense['appliesToKana']:
                    continue
                for term in terms:
                    if term and re.fullmatch(r"[A-Za-z][A-Za-z '-]{1,47}", term) and len(term.split()) <= 4:
                        key = (name, term)
                        pairs[key] = max(pairs.get(key, 0), int(bool(sources))*2 + int(kana['common']))
if len(pairs) < 5000:
    raise ValueError('Unexpected dictionary format or incomplete input')
out = Path(__file__).resolve().parents[1] / 'browser-helper' / 'loanwords.tsv'
out.write_text(''.join(f'{kana}\t{term}\n' for kana, term in sorted(pairs, key=lambda k: (-pairs[k], k))), encoding='utf-8')
