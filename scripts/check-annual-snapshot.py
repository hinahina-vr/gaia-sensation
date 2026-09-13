"""Exercise schema-2 publication/rebuild in an isolated temporary output tree."""
import tempfile
from pathlib import Path
import annual_snapshot as store

with tempfile.TemporaryDirectory(prefix='gaia-annual-') as folder:
    store.DATA = Path(folder)
    def period(year, value):
        return dict(year=year, counts={'measured': 1}, stations=[dict(id='station', measurement=dict(value=value, quality='measured'))])
    store.publish_snapshot('japan-test.json', dict(periods=[period(1955, 1), period(2024, 2)], historyNote='keep provenance'))
    store.publish_snapshot('japan-test.json', dict(periods=[period(2024, 3)]))
    result = store.read_snapshot('japan-test.json')
    assert result['periods'] == [period(1955, 1), period(2024, 3)]
    assert result['historyNote'] == 'keep provenance'
    store.publish_snapshot('japan-test.json', dict(periods=[period(2024, 3)]), check=True)
    try:
        store.publish_snapshot('japan-test.json', dict(periods=[period(2024, 4)]), check=True)
    except AssertionError:
        pass
    else:
        raise AssertionError('Check must reject changed source observations')
print('PASS gzip roundtrip, retained older years/provenance, replacement year, mismatch detection')
