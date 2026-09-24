(() => {
  'use strict';
  const footer = document.querySelector('[data-build-info]');
  if (!footer) return;
  let info = null;
  const messages = {
    ja: { unavailable: '未取得', modified: '未コミット変更あり', unknown: '変更状態は未確認', preview: 'ローカル' },
    en: { unavailable: 'unavailable', modified: 'uncommitted changes', unknown: 'worktree not verified', preview: 'local preview' },
    'zh-CN': { unavailable: '未获取', modified: '有未提交的更改', unknown: '更改状态未确认', preview: '本地预览' },
  };
  const render = () => {
    const labels = messages[window.GaiaI18n?.get()] || messages.ja;
    footer.querySelector('[data-build-short]').textContent = info?.commit.slice(0, 7) || labels.unavailable;
    footer.querySelector('[data-build-sha]').textContent = info?.commit || labels.unavailable;
    footer.querySelector('[data-build-state]').textContent = info
      ? [info.context === 'preview' && labels.preview, info.worktree !== 'clean' && labels[info.worktree]].filter(Boolean).join(' / ')
      : '';
  };
  addEventListener('gaia:language-change', render);
  render();
  // This describes the served build, not the latest commit on a remote branch.
  // No localStorage/cache fallback: a failed request must not show an old SHA.
  fetch(new URL('../build-info.json', document.baseURI), { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    .then(response => {
      if (!response.ok) throw new Error('Build metadata unavailable');
      return response.json();
    })
    .then(value => {
      if (value.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(value.commit)
        || !['clean', 'modified', 'unknown'].includes(value.worktree)
        || !['build', 'preview'].includes(value.context)) throw new Error('Invalid build metadata');
      info = value;
      render();
    })
    .catch(() => { info = null; render(); });
})();
