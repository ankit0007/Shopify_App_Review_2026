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
      precision: data.precision || '1', emptyText: data.emptyText || 'No reviews yet', writeText: data.writeText || 'Write a review',
      star: data.star || '#f5b301', empty: data.empty || '#c5c5c5', starSize: data.starSize || '20',
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

  function renderRating(node, rating) {
    const count = Number(rating?.reviewCount) || 0;
    const average = count > 0 && Number.isFinite(Number(rating?.averageRating)) ? Number(rating.averageRating) : null;
    const click = node.dataset.click !== 'false';
    const showNumber = node.dataset.showNumber !== 'false';
    const halfStars = node.dataset.halfStars !== 'false';
    const productId = numericId(node.dataset.productId);
    const handle = node.dataset.productHandle;
    const target = productId ? document.getElementById(`shopify-product-reviews-${productId}`) : null;
    const nested = Boolean(node.parentElement?.closest('a'));
    const control = document.createElement(click && !nested && (target || handle) ? 'a' : 'div');
    control.className = 'shopify-review-rating__link';
    control.setAttribute('aria-label', average == null
      ? (node.dataset.emptyText || 'No reviews yet')
      : `Rated ${average.toFixed(1)} out of 5 stars from ${count} ${count === 1 ? 'review' : 'reviews'}`);
    if (control instanceof HTMLAnchorElement) {
      if (target) {
        control.href = `#${target.id}`;
        control.addEventListener('click', (event) => {
          event.preventDefault();
          target.scrollIntoView({behavior: 'smooth', block: 'start'});
          target.focus({preventScroll: true});
        });
      } else if (handle && productId) control.href = `/products/${handle}#shopify-product-reviews-${productId}`;
    }
    const stars = document.createElement('span');
    stars.className = 'shopify-review-rating__stars';
    stars.setAttribute('aria-hidden', 'true');
    starFills(average, halfStars).forEach((fill) => {
      const star = document.createElement('span');
      star.className = 'shopify-review-rating__star';
      star.style.setProperty('--fill', String(fill));
      const empty = document.createElement('span');
      empty.className = 'is-empty';
      empty.textContent = average == null ? '☆' : '★';
      const filled = document.createElement('span');
      filled.className = 'is-fill';
      filled.textContent = '★';
      star.append(empty, filled);
      stars.append(star);
    });
    const text = document.createElement('span');
    text.className = 'shopify-review-rating__text';
    if (average == null) text.textContent = `${node.dataset.emptyText || 'No reviews yet'}${click && target ? ` ${node.dataset.writeText || 'Write a review'}` : ''}`;
    else {
      const countLabel = node.dataset.countFormat === 'compact' ? `(${count})` : `${count} ${count === 1 ? 'review' : 'reviews'}`;
      const number = showNumber ? average.toFixed(1) : '';
      const visible = [number, node.dataset.showCount === 'false' ? '' : countLabel].filter(Boolean).join(' ');
      text.textContent = visible;
    }
    control.append(stars, text);
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
        const response = await fetch(`/apps/shopify-review/ratings?productIds=${chunk.join(',')}`);
        const ratings = response.ok ? (await response.json())?.data?.ratings ?? {} : {};
        chunk.forEach((id) => cache.set(id, {averageRating: null, reviewCount: 0}));
        Object.entries(ratings).forEach(([gid, rating]) => {
          const id = numericId(gid);
          if (id) cache.set(id, {averageRating: rating?.averageRating ?? null, reviewCount: Number(rating?.reviewCount) || 0});
        });
      } catch {
        chunk.forEach((id) => cache.set(id, {averageRating: null, reviewCount: 0}));
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
