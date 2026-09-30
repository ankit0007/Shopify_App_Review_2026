// Readable source for extensions/review-widgets/assets/review-widgets.js.
// The asset is minified so the theme app block stays under Shopify's 10 KB JavaScript limit.
(() => {
  if (window.__productReviewsMounted) return;
  window.__productReviewsMounted = true;
  const PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
  const LABELS = {1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent'};

  function widgetsToRemove(nodes) {
    const groups = new Map();
    nodes.forEach((node) => {
      const id = node.dataset.productId;
      if (!id) return;
      const group = groups.get(id) || [];
      group.push(node);
      groups.set(id, group);
    });
    const remove = [];
    groups.forEach((group) => {
      const section = group.find((node) => node.dataset.placement === 'section');
      group.forEach((node) => {
        if (section && node !== section) remove.push(node);
      });
    });
    return remove;
  }

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
      star.innerHTML = `<svg viewBox="0 0 24 24"><path class="bg" d="${PATH}"/></svg><span class="fg"><svg viewBox="0 0 24 24"><path d="${PATH}"/></svg></span>`;
      row.append(star);
    }
    return row;
  }

  function relativeDate(iso) {
    const then = new Date(iso).getTime();
    const days = (Date.now() - then) / 86400000;
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

  async function load(root, cursor) {
    const params = new URLSearchParams({
      shop: root.dataset.shop || '',
      limit: root.dataset.perPage || '5',
      sort: root.dataset.sort || 'newest',
    });
    if (root.dataset.rating) params.set('rating', root.dataset.rating);
    if (cursor) params.set('cursor', cursor);
    const response = await fetch(`/apps/shopify-review/products/${root.dataset.productId}/reviews?${params}`, {signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('reviews unavailable');
    const payload = await response.json();
    if (!payload?.success) throw new Error('reviews unavailable');
    return payload.data;
  }

  function renderSummary(root, data) {
    const summary = root.querySelector('[data-summary]');
    summary.replaceChildren();
    summary.removeAttribute('aria-hidden');
    summary.setAttribute('aria-busy', 'false');
    const count = Number(data.totalReviews) || 0;
    const average = count && Number.isFinite(Number(data.averageRating)) ? Number(data.averageRating) : null;
    if (!count) {
      const empty = el('div', 'sr-empty');
      empty.append(stars(0, 'empty'));
      empty.append(el('h3', '', root.dataset.empty || 'No reviews yet'));
      empty.append(el('p', '', root.dataset.emptyBody || 'Be the first to share your thoughts on this product.'));
      if (root.dataset.showForm !== 'false') {
        const button = el('button', 'sr-btn', 'Write the first review');
        button.type = 'button';
        button.addEventListener('click', () => openForm(root, button));
        empty.append(button);
      }
      summary.append(empty);
      root.querySelector('[data-toolbar]').hidden = true;
      return;
    }
    const score = el('div', 'sr__score');
    const avg = el('div', 'sr__avg', average.toFixed(1));
    avg.append(el('span', '', ' / 5'));
    const summaryStars = stars(average, 'summary');
    summaryStars.setAttribute('aria-hidden', 'true');
    score.setAttribute('aria-label', `Rated ${average.toFixed(1)} out of 5 stars from ${count} ${count === 1 ? 'review' : 'reviews'}`);
    score.append(avg, summaryStars, el('p', 'sr__based', `Based on ${count} ${count === 1 ? 'review' : 'reviews'}`));
    const bars = el('div', 'sr__bars');
    const maxCount = Math.max(0, ...[5, 4, 3, 2, 1].map((star) => Math.max(0, Number(data.distribution?.[String(star)]) || 0)));
    if (root.dataset.showHistogram !== 'false') {
      [5, 4, 3, 2, 1].forEach((star) => {
        const amount = Math.max(0, Number(data.distribution?.[String(star)]) || 0);
        const button = el('button', 'sr__bar');
        button.type = 'button';
        button.dataset.rating = String(star);
        button.disabled = amount === 0;
        button.setAttribute('aria-pressed', root.dataset.rating === String(star) ? 'true' : 'false');
        button.setAttribute('aria-label', `${LABELS[star]} reviews: ${amount}`);
        const label = el('span', 'sr__bar-label', String(star));
        label.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 24 24"><path d="${PATH}"/></svg>`);
        const track = el('span', 'sr__track');
        const fill = el('span', 'sr__fill');
        fill.style.width = `${maxCount ? (amount / maxCount) * 100 : 0}%`;
        track.append(fill);
        button.append(label, track, el('span', 'sr__bar-n', String(amount)));
        button.addEventListener('click', () => {
          root.dataset.rating = root.dataset.rating === String(star) ? '' : String(star);
          refresh(root);
        });
        bars.append(button);
      });
    }
    const write = el('button', 'sr-btn', root.dataset.write || 'Write a review');
    write.type = 'button';
    write.setAttribute('aria-expanded', 'false');
    write.hidden = root.dataset.showForm === 'false';
    write.addEventListener('click', () => openForm(root, write));
    const viewAll = el('a', 'sr-btn sr-btn--ghost', 'View all reviews');
    viewAll.href = '/apps/shopify-review/reviews';
    const actions = el('div', 'sr__actions');
    actions.append(write, viewAll);
    summary.append(score, bars, actions);
  }

  function renderCard(root, review) {
    const item = el('li', 'sr-card');
    if (root.dataset.showAvatar !== 'false') {
      const avatar = el('div', 'sr-avatar', initials(review.displayName));
      avatar.style.setProperty('--h', String(hue(review.displayName)));
      avatar.setAttribute('aria-hidden', 'true');
      item.append(avatar);
    }
    const article = el('article');
    const head = el('div', 'sr-card__head');
    if (root.dataset.showName !== 'false') head.append(el('span', 'sr-card__name', review.displayName || 'Customer'));
    if (root.dataset.showVerified !== 'false' && review.verifiedPurchase) {
      const badge = el('span', 'sr-verified', 'Verified buyer');
      badge.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>');
      head.append(badge);
    }
    if (root.dataset.showDate !== 'false' && review.submittedAt) {
      const time = el('time', 'sr-card__date', relativeDate(review.submittedAt));
      time.dateTime = review.submittedAt;
      head.append(time);
    }
    const star = stars(review.rating, 'card');
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', `${review.rating} out of 5 stars`);
    article.append(head, star);
    if (review.title) article.append(el('h3', 'sr-card__title', review.title));
    const body = el('p', 'sr-card__body', review.body || '');
    article.append(body);
    const more = el('button', 'sr-more', 'Read more');
    more.type = 'button';
    more.hidden = true;
    more.addEventListener('click', () => {
      const open = body.classList.toggle('is-open');
      more.textContent = open ? 'Show less' : 'Read more';
    });
    article.append(more);
    item.append(article);
    requestAnimationFrame(() => {
      more.hidden = body.scrollHeight <= body.clientHeight + 1;
    });
    return item;
  }

  function renderList(root, data, append) {
    const list = root.querySelector('[data-list]');
    if (!append) list.replaceChildren();
    (data.reviews || []).forEach((review) => list.append(renderCard(root, review)));
    const more = root.querySelector('[data-more]');
    more.hidden = !data.nextCursor;
    more.dataset.cursor = data.nextCursor || '';
    const toolbar = root.querySelector('[data-toolbar]');
    const total = root.dataset.rating
      ? Number(data.distribution?.[root.dataset.rating]) || 0
      : Number(data.totalReviews) || 0;
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
        refresh(root);
      });
      showing.append(chip);
    }
    toolbar.append(showing);
    if (root.dataset.showSort !== 'false') {
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
        root.dataset.rating = root.dataset.rating || '';
        refresh(root);
      });
      toolbar.append(select);
    }
  }

  async function refresh(root) {
    const data = await load(root);
    root.__reviewData = data;
    renderSummary(root, data);
    renderList(root, data, false);
  }

  function openForm(root, button) {
    const panel = root.querySelector('[data-form-panel]');
    const open = panel.hidden;
    if (!open) {
      panel.hidden = true;
      button?.setAttribute('aria-expanded', 'false');
      return;
    }
    const start = () => {
      panel.hidden = false;
      button?.setAttribute('aria-expanded', 'true');
      window.ShopifyReviewForm?.(panel, root, () => {
        panel.hidden = true;
        button?.focus();
      });
    };
    if (window.ShopifyReviewForm) {
      start();
      return;
    }
    const script = document.createElement('script');
    script.src = root.dataset.formSrc;
    script.onload = start;
    document.head.append(script);
  }

  document.querySelectorAll('.shopify-review-widget').forEach((node) => {
    if (widgetsToRemove([...document.querySelectorAll('.shopify-review-widget')]).includes(node)) {
      node.remove();
      return;
    }
    const more = node.querySelector('[data-more]');
    more?.addEventListener('click', async () => {
      const data = await load(node, more.dataset.cursor);
      renderList(node, data, true);
    });
    refresh(node).catch(() => {
      const summary = node.querySelector('[data-summary]');
      summary?.replaceChildren(el('p', '', 'Reviews could not be loaded. Please try again.'));
    });
  });
})();
