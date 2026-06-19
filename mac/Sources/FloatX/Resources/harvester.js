// FloatX harvester — injected into the app's own x.com WKWebView.
// Mirrors the extension content script: parse timeline <article>s, gate on
// avatar/media load, enrich over time, and post each to native via
// window.webkit.messageHandlers.floatx.postMessage(...).
(function () {
  if (window.__floatxHarvester) return;
  window.__floatxHarvester = true;

  const send = (type, payload) => {
    try {
      window.webkit.messageHandlers.floatx.postMessage({ type, payload });
    } catch (e) {}
  };

  const SEL = {
    article: 'article[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    userName: '[data-testid="User-Name"]',
    verified: '[aria-label="Verified account"]',
    avatarImg: '[data-testid="Tweet-User-Avatar"] img',
    avatarBg: '[data-testid="Tweet-User-Avatar"] [style*="background-image"]',
    photoContainer: '[data-testid="tweetPhoto"]',
    photo: '[data-testid="tweetPhoto"] img',
    videoEl: '[data-testid="videoComponent"] video, [data-testid="videoPlayer"] video',
    videoComp: '[data-testid="videoComponent"], [data-testid="videoPlayer"]',
    reply: '[data-testid="reply"]',
    repost: '[data-testid="retweet"]',
    like: '[data-testid="like"]',
    viewsLink: 'a[href$="/analytics"]',
    socialContext: '[data-testid="socialContext"]',
  };

  const idFromHref = (h) => {
    const m = (h || '').match(/\/status\/(\d+)/);
    return m ? m[1] : null;
  };

  function parse(article) {
    const nb = article.querySelector(SEL.userName);
    const anchors = nb ? [...nb.querySelectorAll('a[href]')] : [];
    const statusA = anchors.find((a) => /\/status\/\d+/.test(a.getAttribute('href') || ''));
    const permalink = statusA ? statusA.href : '';
    const id = idFromHref(permalink);
    if (!id) return null;

    const handleA =
      anchors.find((a) => a.innerText.trim().startsWith('@')) ||
      anchors.find((a) => /^\/[A-Za-z0-9_]+$/.test(a.getAttribute('href') || ''));
    const handle = (handleA ? handleA.getAttribute('href') : '').replace(/^\//, '');
    const nameA = anchors.find((a) => a !== statusA && a !== handleA && a.innerText.trim() !== '');
    let author = (nameA ? nameA.innerText : '').replace(/\s+/g, ' ').trim();
    if (!author || author === '•') author = handle;

    const verified = !!(nb && nb.querySelector(SEL.verified));
    const text = (article.querySelector(SEL.tweetText) || {}).innerText || '';

    let avatarUrl = (article.querySelector(SEL.avatarImg) || {}).src || '';
    if (!avatarUrl) {
      const bg = article.querySelector(SEL.avatarBg);
      if (bg) {
        const m = bg.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
        if (m) avatarUrl = m[1];
      }
    }

    const media = [];
    article.querySelectorAll(SEL.photo).forEach((img) => {
      if (img.src) media.push({ type: 'image', url: img.src });
    });
    const v = article.querySelector(SEL.videoEl);
    if (v) {
      // currentSrc is the playable stream (often a blob: MSE URL or mp4).
      const vurl = v.currentSrc || v.src || '';
      const poster = v.poster || '';
      media.push({ type: 'video', url: poster, videoURL: vurl });
    } else if (article.querySelector(SEL.videoComp) && media.length === 0) {
      media.push({ type: 'video', url: '' });
    }

    const timeEl = (statusA && statusA.querySelector('time')) || article.querySelector('time');
    const timeDisplay = timeEl ? timeEl.textContent.trim() : '';
    // Absolute timestamp (ISO) from the <time datetime="..."> attribute.
    const timestamp = timeEl ? (timeEl.getAttribute('datetime') || '') : '';

    // Engagement count for an action button. Prefer the visible abbreviated
    // number (e.g. "1.2K"); if the button text is empty, fall back to the exact
    // number embedded in the aria-label ("1234 Likes. Like" / "12 reposts").
    const count = (sel) => {
      const el = article.querySelector(sel);
      if (!el) return '';
      const txt = (el.textContent || '').trim();
      if (txt) return txt;
      const label = el.getAttribute('aria-label') || '';
      const m = label.replace(/,/g, '').match(/([\d.]+\s*[KMB]?)/i);
      return m ? m[1].replace(/\s+/g, '') : '';
    };
    const engagement = {
      replies: count(SEL.reply),
      reposts: count(SEL.repost),
      likes: count(SEL.like),
      views: count(SEL.viewsLink),
    };

    const ctx = (article.querySelector(SEL.socialContext) || {}).innerText || '';
    const head = article.innerText.slice(0, 400);
    const isAd = /Promoted|\bAd\b/.test(ctx) || /Promoted/.test(head);
    const isReply = /Replying to/.test(article.innerText.slice(0, 200));
    const isRepost = /reposted/i.test(ctx);

    // Translatable if the text contains non-Latin script (CJK, Hangul, Arabic,
    // Cyrillic, Thai, etc.) — a good proxy for "show the translate button".
    const foreign = /[぀-ヿ㐀-鿿가-힯؀-ۿЀ-ӿ฀-๿]/.test(text);

    return {
      id, author, handle, avatarUrl, verified, text, media, timeDisplay, timestamp,
      engagement, permalink, foreign,
      flags: { isAd, isReply, isRepost, hasText: text.trim().length > 0 },
    };
  }

  function mediaLoading(article) {
    const containers = article.querySelectorAll(SEL.photoContainer).length;
    if (containers === 0) return false;
    const loaded = [...article.querySelectorAll(SEL.photo)].filter((i) => i.src).length;
    return loaded < containers;
  }

  const seen = new Set();

  function scan() {
    document.querySelectorAll(SEL.article).forEach((a) => {
      const p = parse(a);
      if (!p || p.flags.isAd) return;
      const known = seen.has(p.id);
      if (!known) {
        if (!p.avatarUrl) return; // wait for lazy-load
        if (mediaLoading(a)) return;
        seen.add(p.id);
      }
      send('post', p);
    });
  }

  // Translate a tweet by id: click X's "Translate post" control, then read the
  // translated text X injects. Returns the translation string (async via the
  // native message handler 'translation' as {id, text}).
  window.__floatxTranslate = function (id) {
    const arts = [...document.querySelectorAll(SEL.article)];
    const art = arts.find((a) => a.querySelector('a[href*="/status/' + id + '"]'));
    const sendBack = (text) => {
      try { window.webkit.messageHandlers.translation.postMessage({ id: id, text: text }); } catch (e) {}
    };
    if (!art) { sendBack(''); return; }

    // The translate trigger is a button/link labelled "Translate post".
    const trigger = [...art.querySelectorAll('[role="button"], span, div')]
      .find((el) => /^Translate post$/i.test((el.textContent || '').trim()));
    if (trigger) trigger.click();

    // After clicking, X renders the translation under a "Translated from …" note.
    // Poll for it; fall back to empty if it never appears.
    let tries = 0;
    const t = setInterval(() => {
      const note = [...art.querySelectorAll('div, span')]
        .find((el) => /^Translated from /i.test((el.textContent || '').trim()));
      // The translated body is the tweetText AFTER translation completes.
      const body = art.querySelector(SEL.tweetText);
      if (note && body) {
        clearInterval(t);
        sendBack((body.innerText || '').trim());
      } else if (++tries > 30) {
        clearInterval(t);
        sendBack(body ? (body.innerText || '').trim() : '');
      }
    }, 200);
  };

  // Perform a like/repost on a specific tweet by id, by clicking its real
  // button in the timeline DOM. Called from native via evaluateJavaScript.
  // Returns true if the button was found and clicked.
  window.__floatxAction = function (id, action) {
    const arts = [...document.querySelectorAll(SEL.article)];
    const art = arts.find((a) => {
      const link = a.querySelector('a[href*="/status/' + id + '"]');
      return !!link;
    });
    if (!art) return false;
    // 'like' toggles like/unlike; 'repost' opens the repost menu then confirms.
    if (action === 'like') {
      const btn = art.querySelector('[data-testid="like"], [data-testid="unlike"]');
      if (btn) { btn.click(); return true; }
    } else if (action === 'repost') {
      const btn = art.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
      if (btn) {
        btn.click();
        // X shows a confirmation menu; click the confirm item shortly after.
        setTimeout(() => {
          const confirm = document.querySelector('[data-testid="retweetConfirm"], [data-testid="unretweetConfirm"]');
          if (confirm) confirm.click();
        }, 120);
        return true;
      }
    }
    return false;
  };

  // Observe new articles + periodic re-scan for enrichment, like the extension.
  let scheduled = false;
  const obs = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  obs.observe(document.body, { childList: true, subtree: true });
  setInterval(scan, 1500);

  // On-demand scroll to load more posts (called by the app when the widget's
  // queue runs low — keeps doomscrolling from ever hitting a dead end).
  window.__floatxScrollMore = function () {
    window.scrollBy({ top: window.innerHeight * 1.5, behavior: 'smooth' });
    // Scan a few times as new articles stream in.
    var n = 0;
    var t = setInterval(function () { scan(); if (++n > 6) clearInterval(t); }, 350);
  };

  // Gentle background auto-scroll so the feed keeps producing fresh posts.
  setInterval(function () {
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
  }, 5000);

  send('ready', { url: location.href });
  scan();
})();
