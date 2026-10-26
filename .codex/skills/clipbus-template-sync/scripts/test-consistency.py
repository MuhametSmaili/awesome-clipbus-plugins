from pathlib import Path
import json, shutil, subprocess, tempfile

repo = Path(__file__).resolve().parents[4]
checker = repo / '.agents/skills/clipbus-template-sync/scripts/check-consistency.mjs'
shared = ['.npmrc', 'AGENTS.md', 'env.d.ts', 'eslint.config.mjs', 'tsconfig.json', 'vite.config.mjs', 'scripts/build-runtime.mjs', 'scripts/install.mjs', 'scripts/ui-pages.mjs', 'src/shared/base.css', 'src/shared/composables/useCard.ts', 'tests/support/plugin.cjs']

with tempfile.TemporaryDirectory(prefix='clipbus-consistency-regression-') as tmp:
    root = Path(tmp)
    for name in ['template-plugin', 'clipbus-fixture-plugin']:
        for rel in ['manifest.json', 'package.json', *shared]:
            dest = root / name / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(repo / 'template-plugin' / rel, dest)
    for script in ['build-ui.mjs', 'verify-build.mjs']:
        source = repo / '.agents/skills/clipbus-plugin-generator/assets/scaffold/scripts' / script
        for dest in [root / '.agents/skills/clipbus-plugin-generator/assets/scaffold/scripts' / script, root / 'clipbus-fixture-plugin/scripts' / script]:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, dest)
    subprocess.run(['git', 'init', '-q', str(root)], check=True)
    subprocess.run(['git', 'add', '.'], cwd=root, check=True)

    def inspect():
        result = subprocess.run(['node', str(checker), str(root), '--json'], capture_output=True, text=True)
        return result.returncode, json.loads(result.stdout)

    assert inspect()[0] == 0
    helper = root / 'template-plugin/scripts/fresh-helper.mjs'
    helper.write_text('export const value = 1;\n')
    code, report = inspect()
    assert code == 1 and any(i['file'] == 'scripts/fresh-helper.mjs' for i in report['issues'])
    helper.unlink()

    retired = root / 'clipbus-retired-plugin'
    retired.mkdir()
    for name in ['manifest.json', 'package.json']:
        shutil.copyfile(root / 'clipbus-fixture-plugin' / name, retired / name)
    subprocess.run(['git', 'add', 'clipbus-retired-plugin'], cwd=root, check=True)
    shutil.rmtree(retired)
    code, report = inspect()
    assert code == 0 and report['plugins'] == ['clipbus-fixture-plugin']

    for name in ['template-plugin', 'clipbus-fixture-plugin']:
        (root / name / 'tests/support/plugin.cjs').unlink()
    assert inspect()[0] == 0

    verifier = root / 'clipbus-fixture-plugin/scripts/verify-build.mjs'
    original = verifier.read_text()
    verifier.unlink()
    code, report = inspect()
    assert code == 1 and any(i['check'] == 'divergent' for i in report['issues'])
    verifier.write_text(original)
    assert inspect()[0] == 0

print('PASS: new untracked helper, retired plugin, deleted shared file, missing generator script')
