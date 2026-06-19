// AUTO-GENERATED from Resources/harvester.js by build — do not edit.
enum HarvesterScript {
    static let source = #"""
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

    const count = (sel) => {
      const el = article.querySelector(sel);
      return el ? (el.textContent || '').trim() : '';
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

    return {
      id, author, handle, avatarUrl, verified, text, media, timeDisplay, timestamp,
      engagement, permalink,
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

  // Gentle auto-scroll so the feed keeps producing fresh posts even unattended.
  setInterval(() => {
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
  }, 8000);

  send('ready', { url: location.href });
  scan();
})();

"""#
}
