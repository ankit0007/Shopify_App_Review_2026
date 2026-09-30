// Storefront script for /apps/shopify-review/reviews. Served by the app, not a theme block.
(() => {
  const root = document.getElementById('shopify-all-reviews');
  if (!root || root.dataset.booted === '1') return;
  root.dataset.booted = '1';
  const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
  const LABELS = {1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent'};

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function stars(value, kind) {
    const row = el('span', `sr-stars sr-stars--${kind || 'card'}`);
    const tenths = Math.round(Number(value || 0) * 10);
    for (let index = 0; index < 5; index += 1) {
      const fill = Math.min(10, Math.max(0, tenths - index * 10)) / 10;
      const star = el('span', 'sr-star');
      star.style.setProperty('--f', String(fill));
      star.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="bg" d="${PATH}"/></svg><span class="fg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATH}"/></svg></span>`;
      row.append(star);
    }
    return row;
  }

  function relativeDate(iso) {
    const days = (Date.now() - new Date(iso).getTime()) / 86400000;
    if (days < 1) return 'Today';
    if (days < 2) return 'Yesterday';
    if (days < 30) return `${Math.floor(days)} days ago`;
    return new Date(iso).toLocaleDateString(undefined, {year: 'numeric', month: 'short', day: 'numeric'});
  }

  function initials(name) {
    return String(name || 'R').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  }

  function hue(name) {
    return [...String(name || '')].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 0);
  }

  function renderSummary(data) {
    const summary = root.querySelector('[data-summary]');
    summary.replaceChildren();
    summary.setAttribute('aria-busy', 'false');
    const count = Number(data.totalReviews) || 0;
    const average = count && Number.isFinite(Number(data.averageRating)) ? Number(data.averageRating) : null;
    if (!count || average == null) {
      const empty = el('div', 'sr-empty');
      const emptyStars = stars(0, 'empty');
      emptyStars.setAttribute('aria-hidden', 'true');
      empty.append(emptyStars, el('h2', '', 'No reviews yet'), el('p', '', 'Approved reviews from this store will appear here.'));
      summary.append(empty);
      root.querySelector('[data-toolbar]').hidden = true;
      return;
    }
    const top = el('div', 'sr__top');
    const score = el('div', 'sr__score');
    score.setAttribute('aria-label', `Rated ${average.toFixed(1)} out of 5 stars from ${count} ${count === 1 ? 'review' : 'reviews'}`);
    const avg = el('div', 'sr__avg', average.toFixed(1));
    avg.append(el('span', '', ' / 5'));
    const summaryStars = stars(average, 'summary');
    summaryStars.setAttribute('aria-hidden', 'true');
    score.append(avg, summaryStars, el('p', 'sr__based', `Based on ${count} ${count === 1 ? 'review' : 'reviews'}`));
    const bars = el('div', 'sr__bars');
    const maxCount = Math.max(0, ...[5, 4, 3, 2, 1].map((star) => Math.max(0, Number(data.distribution?.[String(star)]) || 0)));
    [5, 4, 3, 2, 1].forEach((star) => {
      const amount = Math.max(0, Number(data.distribution?.[String(star)]) || 0);
      const button = el('button', 'sr__bar');
      button.type = 'button';
      button.disabled = amount === 0;
      button.setAttribute('aria-pressed', root.dataset.rating === String(star) ? 'true' : 'false');
      button.setAttribute('aria-label', `${LABELS[star]} reviews: ${amount}`);
      const label = el('span', 'sr__bar-label', String(star));
      label.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${PATH}"/></svg>`);
      const track = el('span', 'sr__track');
      const fill = el('span', 'sr__fill');
      fill.style.width = `${maxCount ? (amount / maxCount) * 100 : 0}%`;
      track.append(fill);
      button.append(label, track, el('span', 'sr__bar-n', String(amount)));
      button.addEventListener('click', () => {
        root.dataset.rating = root.dataset.rating === String(star) ? '' : String(star);
        refresh(false);
      });
      bars.append(button);
    });
    top.append(score, bars);
    summary.append(top);
  }

  function renderCard(review) {
    const item = el('li', 'sr-card');
    const avatar = el('div', 'sr-avatar', initials(review.displayName));
    avatar.style.setProperty('--h', String(hue(review.displayName)));
    avatar.setAttribute('aria-hidden', 'true');
    const article = el('article');
    const head = el('div', 'sr-card__head');
    head.append(el('span', 'sr-card__name', review.displayName || 'Customer'));
    if (review.verifiedPurchase) {
      const badge = el('span', 'sr-verified', 'Verified buyer');
      badge.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>');
      head.append(badge);
    }
    if (review.submittedAt) {
      const time = el('time', 'sr-card__date', relativeDate(review.submittedAt));
      time.dateTime = review.submittedAt;
      head.append(time);
    }
    const star = stars(review.rating, 'card');
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', `${review.rating} out of 5 stars`);
    article.append(head, star);
    if (review.title) article.append(el('h3', 'sr-card__title', review.title));
    article.append(el('p', 'sr-card__body', review.body || ''));
    if (review.product?.title) {
      const product = el('p', 'sr-card__product', 'Product: ');
      if (review.product.url && /^\/products\/[a-z0-9][a-z0-9-]*$/i.test(review.product.url)) {
        const link = el('a', '', review.product.title);
        link.href = review.product.url;
        product.append(link);
      } else product.append(document.createTextNode(review.product.title));
      article.append(product);
    }
    item.append(avatar, article);
    return item;
  }

  async function load(cursor) {
    const params = new URLSearchParams({
      format: 'json',
      shop: root.dataset.shop || '',
      limit: '10',
      sort: root.dataset.sort || 'newest',
    });
    if (root.dataset.rating) params.set('rating', root.dataset.rating);
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/apps/shopify-review/reviews?${params}`, {signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('reviews unavailable');
    const payload = await response.json();
    if (!payload?.success) throw new Error('reviews unavailable');
    return payload.data;
  }

  function renderList(data, append) {
    const list = root.querySelector('[data-list]');
    if (!append) list.replaceChildren();
    (data.reviews || []).forEach((review) => list.append(renderCard(review)));
    const more = root.querySelector('[data-more]');
    more.hidden = !data.nextCursor;
    more.dataset.cursor = data.nextCursor || '';
    const toolbar = root.querySelector('[data-toolbar]');
    const total = root.dataset.rating ? Number(data.distribution?.[root.dataset.rating]) || 0 : Number(data.totalReviews) || 0;
    if (!total) {
      toolbar.hidden = true;
      return;
    }
    toolbar.hidden = false;
    toolbar.replaceChildren();
    const showing = el('div', '', `Showing ${list.children.length} of ${total} reviews`);
    if (root.dataset.rating) {
      const chip = el('button', 'sr__chip', `${root.dataset.rating} star only`);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        root.dataset.rating = '';
        refresh(false);
      });
      showing.append(chip);
    }
    toolbar.append(showing);
    const select = el('select', 'sr-select');
    select.setAttribute('aria-label', 'Sort reviews');
    [['newest', 'Most recent'], ['highest', 'Highest rating'], ['lowest', 'Lowest rating']].forEach(([value, label]) => {
      const option = el('option', '', label);
      option.value = value;
      option.selected = (root.dataset.sort || 'newest') === value;
      select.append(option);
    });
    select.addEventListener('change', () => {
      root.dataset.sort = select.value;
      refresh(false);
    });
    toolbar.append(select);
  }

  async function refresh(append) {
    const error = root.querySelector('[data-error]');
    error.hidden = true;
    try {
      const data = await load(append ? root.querySelector('[data-more]').dataset.cursor : '');
      if (!append) renderSummary(data);
      renderList(data, append);
    } catch {
      error.hidden = false;
      root.querySelector('[data-summary]').setAttribute('aria-busy', 'false');
    }
  }

  root.querySelector('[data-more]').addEventListener('click', () => refresh(true));
  refresh(false);
})();
