(() => {
  const sourceLinks = [
    {
      match: '関係が確認できる記録だけを結ぶ',
      href: 'https://www.globalbioticinteractions.org/',
      label: 'GloBI（生物間相互作用データ）'
    }
  ];

  const normalize = (value) => (value || '').replace(/\s+/g, '');

  function findCaption(match) {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT
    );

    let element;
    while ((element = walker.nextNode())) {
      if (element.matches?.('script, style, a, [data-source-link-ready]')) {
        continue;
      }

      const ownText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.nodeValue)
        .join('');

      if (normalize(ownText).includes(normalize(match))) {
        return element;
      }
    }

    return null;
  }

  function findSourceCluster(caption) {
    let element = caption;

    for (let depth = 0; depth < 5 && element; depth += 1) {
      const text = normalize(element.textContent);
      if (text.includes('SOURCE') && text.length < 180) {
        return element;
      }
      element = element.parentElement;
    }

    return caption;
  }

  function openSource(entry, event) {
    event.preventDefault();
    event.stopPropagation();

    const sourceWindow = window.open(
      entry.href,
      '_blank',
      'noopener,noreferrer'
    );

    if (sourceWindow) {
      sourceWindow.opener = null;
    }
  }

  function enhanceSourceLinks() {
    sourceLinks.forEach((entry) => {
      const caption = findCaption(entry.match);
      if (!caption) return;

      const cluster = findSourceCluster(caption);
      if (cluster.dataset.sourceLinkReady === 'true') return;

      cluster.dataset.sourceLinkReady = 'true';
      cluster.classList.add('source-origin-link');
      cluster.setAttribute('role', 'link');
      cluster.setAttribute('tabindex', '0');
      cluster.setAttribute(
        'aria-label',
        `${entry.label}を新しいタブで開く`
      );
      cluster.setAttribute('title', `${entry.label}を開く`);

      if (!cluster.querySelector('.source-origin-link__mark')) {
        const mark = document.createElement('span');
        mark.className = 'source-origin-link__mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '↗';
        cluster.append(mark);
      }

      cluster.addEventListener('click', (event) => {
        openSource(entry, event);
      });

      cluster.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          openSource(entry, event);
        }
      });
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .source-origin-link {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: .55em;
      cursor: pointer;
      transition: color .24s ease, text-shadow .24s ease, opacity .24s ease;
    }

    .source-origin-link::after {
      content: "";
      position: absolute;
      right: 0;
      bottom: -.38rem;
      left: 0;
      height: 1px;
      background: linear-gradient(
        90deg,
        transparent,
        #96efe0 32%,
        #9fc8ff 70%,
        transparent
      );
      opacity: 0;
      transform: scaleX(.2);
      transition: opacity .24s ease, transform .3s ease;
    }

    .source-origin-link:hover,
    .source-origin-link:focus-visible {
      color: #f0ffff;
      text-shadow: 0 0 18px rgba(126, 235, 222, .55);
      outline: none;
    }

    .source-origin-link:hover::after,
    .source-origin-link:focus-visible::after {
      opacity: 1;
      transform: scaleX(1);
    }

    .source-origin-link__mark {
      flex: 0 0 auto;
      color: #91eadb;
      font-size: .86em;
      opacity: .76;
      transform: translateX(-.2em);
      transition: opacity .24s ease, transform .24s ease;
    }

    .source-origin-link:hover .source-origin-link__mark,
    .source-origin-link:focus-visible .source-origin-link__mark {
      opacity: 1;
      transform: translateX(0);
    }
  `;
  document.head.append(style);

  let queued = false;
  const scheduleEnhancement = () => {
    if (queued) return;

    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceSourceLinks();
    });
  };

  new MutationObserver(scheduleEnhancement).observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleEnhancement, {
      once: true
    });
  } else {
    scheduleEnhancement();
  }
})();
