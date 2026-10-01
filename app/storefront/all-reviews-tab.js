(() => {
  if (window.__srAllReviews) return;
  window.__srAllReviews = true;
  const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
  const host = document.querySelector('[data-all-reviews-tab]');
  const shop = host?.dataset.shop || window.Shopify?.shop || '';
  if (!shop) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stars(value) {
    const row = el('span', 'sr-tab__stars');
    const tenths = Math.round(Number(value || 0) * 10);
    for (let index = 0; index < 5; index += 1) {
      const fill = Math.min(10, Math.max(0, tenths - index * 10)) / 10;
      const star = el('span', 'sr-star');
      star.style.setProperty('--f', String(fill));
      star.innerHTML = `<svg viewBox="0 0 24 24"><path class="bg" d="${PATH}"/></svg><span class="fg"><svg viewBox="0 0 24 24"><path d="${PATH}"/></svg></span>`;
      row.append(star);
    }
    return row;
  }

  const tab = el('button', 'sr-tab');
  tab.type = 'button';
  tab.setAttribute('aria-haspopup', 'dialog');
  tab.setAttribute('aria-expanded', 'false');
  tab.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATH}"/></svg><span>Reviews</span>`;

  function applyButtonSettings(data) {
    const position = String(data.reviewsButtonPosition || 'middle-right');
    const [row, column] = position.split('-');
    const horizontal = Math.min(500, Math.max(0, Number(data.reviewsButtonHorizontalOffset) || 0));
    const vertical = Math.min(500, Math.max(0, Number(data.reviewsButtonVerticalOffset) || 50));
    const transforms = [];
    tab.style.top = '';
    tab.style.right = '';
    tab.style.bottom = '';
    tab.style.left = '';
    tab.style.marginTop = '';
    tab.style.marginLeft = '';
    tab.style.transform = '';
    if (row === 'middle') {
      tab.style.top = '50%';
      tab.style.marginTop = `${vertical - 50}px`;
      transforms.push('translateY(-50%)');
    } else if (row === 'top') {
      tab.style.top = `${vertical}px`;
    } else {
      tab.style.bottom = `${vertical}px`;
    }
    if (column === 'left') tab.style.left = `${horizontal}px`;
    else if (column === 'center') {
      tab.style.left = '50%';
      tab.style.marginLeft = `${horizontal}px`;
      transforms.push('translateX(-50%)');
    } else tab.style.right = `${horizontal}px`;
    tab.style.transform = transforms.join(' ') || 'none';
    tab.style.writingMode = data.reviewsButtonOrientation === 'horizontal' ? 'horizontal-tb' : 'vertical-rl';
    tab.style.flexDirection = data.reviewsButtonOrientation === 'horizontal' ? 'row' : 'column';
    tab.style.borderRadius = data.reviewsButtonOrientation === 'horizontal' ? '12px' : '12px 0 0 12px';
  }
  const modal = el('div', 'sr-tab-modal');
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'All reviews');
  const dialog = el('div', 'sr-tab-dialog shopify-reviews');
  const head = el('div', 'sr-tab-dialog__head');
  const summary = el('div', 'sr-tab-dialog__summary');
  const close = el('button', 'sr-tab-dialog__close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close reviews');
  head.append(summary, close);
  const grid = el('div', 'sr-tab-grid');
  const more = el('button', 'sr-tab-more', 'Load more');
  more.type = 'button';
  more.hidden = true;
  const status = el('p', 'sr-tab-status', 'Loading reviews…');
  dialog.append(head, status, grid, more);
  modal.append(dialog);

  function shut() {
    modal.hidden = true;
    document.documentElement.style.overflow = '';
    tab.setAttribute('aria-expanded', 'false');
    tab.focus();
  }

  let cursor = '';
  let loading = false;

  function card(review) {
    const item = el('article', 'sr-tab-card');
    const image = review.product?.imageUrl;
    if (image) {
      const photo = el('img', 'sr-tab-card__photo');
      photo.src = image;
      photo.alt = '';
      item.append(photo);
    }
    const body = el('div', 'sr-tab-card__body');
    const star = stars(review.rating);
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', `${review.rating} out of 5 stars`);
    const who = el('div', 'sr-tab-card__who');
    who.append(el('strong', '', review.displayName || 'Customer'));
    if (review.verifiedPurchase) who.append(el('span', 'sr-tab-card__verified', 'Verified'));
    const when = review.submittedAt ? el('time', 'sr-tab-card__date', new Date(review.submittedAt).toLocaleDateString()) : null;
    if (when) when.dateTime = review.submittedAt;
    body.append(star, who);
    if (when) body.append(when);
    if (review.title) body.append(el('h3', '', review.title));
    body.append(el('p', '', review.body || ''));
    if (review.product?.title) {
      const product = el(review.product.url ? 'a' : 'span', 'sr-tab-card__product', review.product.title);
      if (review.product.url) product.href = review.product.url;
      body.append(product);
    }
    item.append(body);
    return item;
  }

  async function load(next) {
    if (loading) return;
    loading = true;
    more.disabled = true;
    const params = new URLSearchParams({format: 'json', shop, limit: '6', sort: 'newest'});
    if (next) params.set('cursor', next);
    try {
      const response = await fetch(`/apps/shopify-review/reviews?${params}`, {signal: AbortSignal.timeout(8000)});
      const payload = await response.json();
      if (!payload?.success) throw new Error('unavailable');
      const data = payload.data;
      if (data.showAllReviewsTab === false) {
        tab.remove();
        modal.remove();
        return;
      }
      applyButtonSettings(data);
      if (!tab.isConnected) document.body.append(tab, modal);
      const count = Number(data.totalReviews) || 0;
      const average = count && Number.isFinite(Number(data.averageRating)) ? Number(data.averageRating) : null;
      summary.replaceChildren();
      if (average != null) {
        const row = stars(average);
        row.setAttribute('aria-label', `Rated ${average.toFixed(1)} out of 5 from ${count} reviews`);
        summary.append(row);
      }
      summary.append(el('strong', '', `${count} ${count === 1 ? 'Review' : 'Reviews'}`));
      if (!next) grid.replaceChildren();
      (data.reviews || []).forEach((review) => grid.append(card(review)));
      cursor = data.nextCursor || '';
      more.hidden = !cursor;
      status.hidden = grid.children.length > 0;
      status.textContent = grid.children.length ? '' : 'No reviews yet.';
    } catch {
      status.hidden = false;
      status.textContent = 'Reviews could not be loaded. Please try again.';
    } finally {
      loading = false;
      more.disabled = false;
    }
  }

  function open() {
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    tab.setAttribute('aria-expanded', 'true');
    close.focus();
    if (!grid.children.length) load('');
  }

  tab.addEventListener('click', open);
  close.addEventListener('click', shut);
  more.addEventListener('click', () => load(cursor));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) shut();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) shut();
  });
  load('');
})();
