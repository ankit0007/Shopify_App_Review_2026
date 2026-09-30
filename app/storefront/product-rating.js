// Readable source for extensions/review-widgets/assets/product-rating.js.
// The asset is minified so the theme app block stays under Shopify's 10 KB JavaScript limit.
(function () {
  if (window.__productRatingsMounted) return;
  window.__productRatingsMounted = true;
  const cache = new Map();
  const handleIds = new Map();
  let scanning = false;
  let pending = false;

  function handleFromHref(href) {
    if (!href || /^(javascript|data):/i.test(String(href).trim())) return null;
    let path = String(href).trim();
    try { path = new URL(path, location.origin).pathname; } catch { return null; }
    const match = path.match(/\/products\/([^/]+)/i);
    if (!match) return null;
    try { path = decodeURIComponent(match[1]).toLowerCase(); } catch { return null; }
    return /^[a-z0-9][a-z0-9-]*$/.test(path) ? path : null;
  }

  function numericId(value) {
    if (!value) return null;
    const token = String(value).trim();
    const gid = /^gid:\/\/shopify\/Product\/(\d{1,20})$/.exec(token);
    const id = gid ? gid[1] : token;
    return /^\d{1,20}$/.test(id) ? id : null;
  }

  function classText(element) {
    return typeof element.className === 'string' ? element.className.toLowerCase() : '';
  }

  function handlesIn(root) {
    const found = new Set();
    root.querySelectorAll('a[href*="/products/"]').forEach((anchor) => {
      const handle = handleFromHref(anchor.getAttribute('href'));
      if (handle) found.add(handle);
    });
    return found;
  }

  function banned(node) {
    const name = `${node.tagName} ${classText(node)} ${node.id || ''}`.toLowerCase();
    return node.tagName === 'FOOTER' || node.tagName === 'HEADER' || /(cart-drawer|cart_drawer|mini-cart|search-modal)/.test(name);
  }

  function cardFrom(anchor) {
    if (anchor.closest('footer, header')) return null;
    let node = anchor.parentElement;
    let card = null;
    while (node && node !== document.body) {
      if (node.hasAttribute('data-rating-source') || banned(node)) break;
      const found = handlesIn(node);
      if (found.size > 1) break;
      if (found.size === 1) card = node;
      node = node.parentElement;
    }
    return card;
  }

  function inMedia(element, card) {
    let node = element;
    while (node && node !== card) {
      if (node.tagName === 'PICTURE' || /(^|[^a-z])(media|image|gallery|thumbnail|photo|picture)([^a-z]|$)/.test(classText(node))) return true;
      node = node.parentElement;
    }
    return false;
  }

  function slot(card, handle) {
    for (const title of card.querySelectorAll('h1,h2,h3,h4,[class*="title"],[class*="heading"]')) {
      if (inMedia(title, card)) continue;
      const handles = [...title.querySelectorAll('a[href*="/products/"]')].map((anchor) => handleFromHref(anchor.getAttribute('href'))).filter(Boolean);
      if (handles.length === 1 && handles[0] === handle) return {mode: 'after', element: title};
    }
    const price = [...card.querySelectorAll('[class*="price"],[data-product-price]')].find((element) => !inMedia(element, card));
    if (price) return {mode: 'before', element: price};
    const info = [...card.querySelectorAll('[class*="information"],[class*="product-info"],[class*="card-content"],[class*="product-details"],[class*="card__content"]')]
      .find((element) => !inMedia(element, card) && handlesIn(element).size < 2);
    return info ? {mode: 'append', element: info} : null;
  }

  function place(node, point) {
    if (point.mode === 'after') point.element.insertAdjacentElement('afterend', node);
    else if (point.mode === 'before') point.element.insertAdjacentElement('beforebegin', node);
    else point.element.append(node);
  }

  function settingsFrom(source) {
    if (!source) return null;
    const data = source.dataset;
    return {
      click: data.click !== 'false', showCount: data.showCount !== 'false', showNumber: data.showNumber !== 'false',
      halfStars: data.halfStars !== 'false', countFormat: data.countFormat || 'words',
      precision: data.precision || '1', emptyText: data.emptyText || 'Be the first to review', writeText: data.writeText || 'Write a review',
      hideWhenEmpty: data.hideEmpty === 'true',
      star: data.star || '#f5b301', empty: data.empty || '#d9dce1', starSize: data.starSize || '20',
      textSize: data.textSize || '14', space: data.space || '8', align: data.align || 'left',
    };
  }

  function createNode(settings, productId, handle) {
    const node = document.createElement('div');
    node.className = 'shopify-review-rating';
    node.hidden = true;
    Object.assign(node.dataset, {
      productRating: '', productId, shopifyReviewRatingProductId: productId, productHandle: handle, placement: 'embed',
      click: settings.click ? 'true' : 'false', showCount: settings.showCount ? 'true' : 'false',
      showNumber: settings.showNumber ? 'true' : 'false', halfStars: settings.halfStars ? 'true' : 'false',
      countFormat: settings.countFormat, precision: settings.precision, emptyText: settings.emptyText, writeText: settings.writeText,
      hideEmpty: settings.hideWhenEmpty ? 'true' : 'false',
    });
    node.style.cssText = `--rating-star:${settings.star};--rating-empty:${settings.empty};--rating-size:${settings.starSize}px;--rating-text:${settings.textSize}px;--rating-space:${settings.space}px;text-align:${settings.align}`;
    return node;
  }

  function starFills(average, halfStars) {
    if (!Number.isFinite(average)) return [0, 0, 0, 0, 0];
    const tenths = Math.round(average * 10);
    return [0, 1, 2, 3, 4].map((index) => {
      const fill = Math.min(10, Math.max(0, tenths - index * 10)) / 10;
      return halfStars === false ? (fill >= 0.5 ? 1 : 0) : fill;
    });
  }

  const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
  let ratingsWarned = false;

  function starRow(average, halfStars) {
    const stars = document.createElement('span');
    stars.className = 'sr-stars';
    stars.setAttribute('aria-hidden', 'true');
    starFills(average, halfStars).forEach((fill) => {
      const star = document.createElement('span');
      star.className = 'sr-star';
      star.style.setProperty('--f', String(fill));
      star.innerHTML = `<svg viewBox="0 0 24 24"><path class="bg" d="${STAR_PATH}"/></svg><span class="fg"><svg viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg></span>`;
      stars.append(star);
    });
    return stars;
  }

  function renderRating(node, rating) {
    if (rating?.failed) {
      node.hidden = true;
      node.replaceChildren();
      if (!ratingsWarned) {
        ratingsWarned = true;
        console.warn('Product ratings could not be loaded.');
      }
      return;
    }
    const count = Number(rating?.reviewCount) || 0;
    const average = count > 0 && Number.isFinite(Number(rating?.averageRating)) ? Number(rating.averageRating) : null;
    if (node.dataset.hideEmpty === 'true' && average == null) {
      node.hidden = true;
      node.replaceChildren();
      return;
    }
    const click = node.dataset.click !== 'false';
    const showNumber = node.dataset.showNumber !== 'false';
    const halfStars = node.dataset.halfStars !== 'false';
    const productId = numericId(node.dataset.productId);
    const target = productId ? document.getElementById(`shopify-product-reviews-${productId}`) : null;
    const nested = Boolean(node.parentElement?.closest('a'));
    const control = document.createElement(click && !nested && target ? 'a' : 'div');
    control.className = 'sr-rating__link';
    control.setAttribute('aria-label', average == null
      ? (node.dataset.emptyText || 'Be the first to review')
      : `Rated ${average.toFixed(1)} out of 5 stars, ${count} ${count === 1 ? 'review' : 'reviews'}`);
    if (control instanceof HTMLAnchorElement && target) {
      control.href = `#${target.id}`;
      control.addEventListener('click', (event) => {
        event.preventDefault();
        target.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
        target.focus({preventScroll: true});
      });
    }
    const text = document.createElement('span');
    text.className = 'sr-rating__text';
    if (average == null) text.textContent = node.dataset.emptyText || 'Be the first to review';
    else {
      if (showNumber) {
        const number = document.createElement('strong');
        number.textContent = average.toFixed(1);
        text.append(number, ' ');
      }
      if (node.dataset.showCount !== 'false') {
        const countLabel = document.createElement('span');
        countLabel.textContent = node.dataset.countFormat === 'compact' ? `(${count})` : `${count} ${count === 1 ? 'review' : 'reviews'}`;
        text.append(countLabel);
      }
    }
    control.append(starRow(average, halfStars), text);
    node.replaceChildren(control);
    node.hidden = false;
    node.dataset.shopifyReviewRatingMounted = '1';
  }

  function sectionIds() {
    return new Set([...document.querySelectorAll('.shopify-review-rating[data-placement="section"]')].map((node) => numericId(node.dataset.productId)).filter(Boolean));
  }

  function findCard(handle) {
    for (const anchor of document.querySelectorAll('a[href*="/products/"]')) {
      if (handleFromHref(anchor.getAttribute('href')) !== handle) continue;
      const card = cardFrom(anchor);
      const point = card && card.getAttribute('data-shopify-review-rating-mounted') !== '1' && !card.querySelector('.shopify-review-rating') ? slot(card, handle) : null;
      if (card && point) return {card, point};
    }
    return null;
  }

  async function resolveHandle(handle) {
    if (handleIds.has(handle)) return handleIds.get(handle);
    const knownId = numericId([...document.querySelectorAll('.shopify-review-rating[data-product-handle]')].find((node) => node.dataset.productHandle === handle)?.dataset.productId);
    if (knownId) return handleIds.set(handle, knownId), knownId;
    try {
      const response = await fetch(`/products/${encodeURIComponent(handle)}.js`, {credentials: 'same-origin'});
      const product = response.ok ? await response.json() : null;
      const id = product && String(product.handle || '').toLowerCase() === handle ? numericId(String(product.id)) : null;
      handleIds.set(handle, id);
      return id;
    } catch {
      handleIds.set(handle, null);
      return null;
    }
  }

  async function fetchRatings(ids) {
    const unique = [...new Set(ids.filter((id) => numericId(id) && !cache.has(id)))];
    for (let index = 0; index < unique.length; index += 50) {
      const chunk = unique.slice(index, index + 50);
      try {
        const response = await fetch(`/apps/shopify-review/ratings?productIds=${chunk.join(',')}`, {signal: AbortSignal.timeout(3000)});
        if (!response.ok) throw new Error('ratings unavailable');
        const ratings = (await response.json())?.data?.ratings ?? {};
        chunk.forEach((id) => cache.set(id, {averageRating: null, reviewCount: 0}));
        Object.entries(ratings).forEach(([gid, rating]) => {
          const id = numericId(gid);
          if (id) cache.set(id, {averageRating: rating?.averageRating ?? null, reviewCount: Number(rating?.reviewCount) || 0});
        });
      } catch {
        chunk.forEach((id) => cache.set(id, {failed: true, averageRating: null, reviewCount: 0}));
      }
    }
  }

  async function scan() {
    const source = document.querySelector('[data-rating-source]');
    const pageType = source?.dataset.pageType || '';
    const settings = settingsFrom(source);
    if (pageType === 'product') {
      const seen = new Set();
      document.querySelectorAll('.shopify-review-rating[data-placement="section"]').forEach((node) => {
        const id = numericId(node.dataset.productId);
        if (!id) return;
        if (seen.has(id)) node.remove();
        else seen.add(id);
      });
    }
    const blocked = pageType === 'product' ? sectionIds() : new Set();
    document.querySelectorAll('.shopify-review-rating[data-placement="embed"]').forEach((node) => {
      if (blocked.has(numericId(node.dataset.productId))) node.remove();
    });
    document.querySelectorAll('[data-rating-source] .shopify-review-rating[data-product-handle]').forEach((node) => {
      const handle = node.dataset.productHandle;
      const id = numericId(node.dataset.productId);
      const match = handle && id && !blocked.has(id) ? findCard(handle) : null;
      const pageTitle = pageType === 'product' ? (document.querySelector('main h1') || document.querySelector('h1')) : null;
      if (match && !(pageTitle && match.card.contains(pageTitle))) {
        place(node, match.point);
        match.card.setAttribute('data-shopify-review-rating-mounted', '1');
        match.card.setAttribute('data-shopify-review-rating-product-id', id);
      } else node.remove();
    });
    const cardPages = ['collection', 'search', 'product', 'index'];
    if (settings && cardPages.includes(pageType)) {
      const pageTitle = pageType === 'product' ? (document.querySelector('main h1') || document.querySelector('h1')) : null;
      for (const anchor of document.querySelectorAll('a[href*="/products/"]')) {
        const handle = handleFromHref(anchor.getAttribute('href'));
        const card = handle ? cardFrom(anchor) : null;
        if (!card || (pageTitle && card.contains(pageTitle))) continue;
        if (card.getAttribute('data-shopify-review-rating-mounted') === '1' || card.querySelector('.shopify-review-rating')) {
          if (card.querySelector('.shopify-review-rating')) card.setAttribute('data-shopify-review-rating-mounted', '1');
          continue;
        }
        const point = slot(card, handle);
        if (!point) continue;
        const id = numericId(card.getAttribute('data-product-id')) || await resolveHandle(handle);
        if (!id || blocked.has(id)) continue;
        place(createNode(settings, id, handle), point);
        card.setAttribute('data-shopify-review-rating-mounted', '1');
        card.setAttribute('data-shopify-review-rating-product-id', id);
      }
    }
    const ids = [...document.querySelectorAll('.shopify-review-rating[data-product-id]')].map((node) => numericId(node.dataset.productId)).filter(Boolean);
    await fetchRatings(ids);
    document.querySelectorAll('.shopify-review-rating[data-product-id]').forEach((node) => {
      const id = numericId(node.dataset.productId);
      if (node.dataset.shopifyReviewRatingMounted === '1' || !id || !cache.has(id)) return;
      if (node.dataset.placement !== 'section' && node.closest('[data-rating-source]')) return;
      renderRating(node, cache.get(id));
    });
  }

  function schedule() {
    pending = true;
    if (scanning) return;
    pending = false;
    scanning = true;
    scan().finally(() => {
      scanning = false;
      if (pending) schedule();
    });
  }

  new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === 1 && !node.classList?.contains('shopify-review-rating') && !node.closest?.('.shopify-review-rating')));
    if (relevant) schedule();
  }).observe(document.documentElement, {childList: true, subtree: true});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once: true});
  else schedule();
})();
