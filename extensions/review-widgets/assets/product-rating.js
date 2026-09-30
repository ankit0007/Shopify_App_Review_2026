(function () {
  if (window.__productRatingsMounted) return;
  window.__productRatingsMounted = true;

  function widgetsToRemove(widgets) {
    const keeper = new Map();
    widgets.forEach((widget) => {
      const current = keeper.get(widget.productId);
      if (!current || (current.placement !== 'section' && widget.placement === 'section')) {
        keeper.set(widget.productId, widget);
      }
    });
    const keep = new Set([...keeper.values()].map((widget) => widget.id));
    return widgets.filter((widget) => !keep.has(widget.id)).map((widget) => widget.id);
  }

  const ratingNodes = [...document.querySelectorAll('.shopify-review-rating[data-product-id]')].map((element, index) => {
    element.dataset.widgetId = element.dataset.widgetId || `review-rating-${index}`;
    return {id: element.dataset.widgetId, productId: element.dataset.productId, placement: element.dataset.placement || 'section', element};
  });
  const removeRatings = new Set(widgetsToRemove(ratingNodes));
  ratingNodes.forEach((rating) => {
    if (removeRatings.has(rating.id)) rating.element.remove();
  });

  function selectorValue(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-z0-9-]/gi, '');
  }

  document.querySelectorAll('.shopify-review-rating[data-placement="embed"]').forEach((node) => {
    const productId = node.dataset.productId || '';
    if (document.querySelector(`.shopify-review-rating[data-placement="section"][data-product-id="${selectorValue(productId)}"]`)) {
      node.remove();
      return;
    }
    const title = (node.dataset.productTitle || '').trim();
    const heading = [...document.querySelectorAll('h1')].find((item) => item.textContent.trim() === title);
    if (heading) {
      heading.insertAdjacentElement('afterend', node);
      return;
    }
    const handle = node.dataset.productHandle;
    if (!handle) return;
    const link = document.querySelector(`a[href*="/products/${selectorValue(handle)}"]`);
    if (link?.parentElement && !link.parentElement.querySelector('.shopify-review-rating')) {
      link.parentElement.append(node);
    }
  });

  function starFills(average) {
    if (!Number.isFinite(average)) return [0, 0, 0, 0, 0];
    const tenths = Math.round(average * 10);
    return [0, 1, 2, 3, 4].map((index) => Math.min(10, Math.max(0, tenths - index * 10)) / 10);
  }

  function renderRating(node, rating) {
    const count = Number(rating?.reviewCount) || 0;
    const average = count > 0 && Number.isFinite(Number(rating?.averageRating)) ? Number(rating.averageRating) : null;
    const showCount = node.dataset.showCount !== 'false';
    const compact = node.dataset.countFormat === 'compact';
    const click = node.dataset.click !== 'false';
    const target = document.getElementById(`shopify-product-reviews-${node.dataset.productId}`);
    const label = average == null
      ? 'No reviews yet'
      : `Rated ${average.toFixed(1)} out of 5 stars, based on ${count} ${count === 1 ? 'review' : 'reviews'}`;
    const control = document.createElement(click && target ? 'a' : 'div');
    control.className = 'shopify-review-rating__link';
    control.setAttribute('aria-label', label);
    if (control instanceof HTMLAnchorElement && target) {
      control.href = `#${target.id}`;
      control.addEventListener('click', (event) => {
        event.preventDefault();
        target.scrollIntoView({behavior: 'smooth', block: 'start'});
        target.focus({preventScroll: true});
      });
    }
    const stars = document.createElement('span');
    stars.className = 'shopify-review-rating__stars';
    stars.setAttribute('aria-hidden', 'true');
    starFills(average).forEach((fill) => {
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
    if (average == null) {
      text.textContent = `${node.dataset.emptyText || 'No reviews yet'}${click && target ? ` ${node.dataset.writeText || 'Write a review'}` : ''}`;
    } else {
      const countLabel = compact ? `(${count})` : `${count} ${count === 1 ? 'review' : 'reviews'}`;
      text.textContent = showCount ? `${average.toFixed(1)} ${countLabel}` : average.toFixed(1);
    }
    control.append(stars, text);
    const placed = node.dataset.placement === 'section' || !node.closest('[data-rating-source]');
    if (!placed) {
      node.remove();
      return;
    }
    node.replaceChildren(control);
    node.hidden = false;
    node.removeAttribute('aria-busy');
  }

  const visibleRatings = [...document.querySelectorAll('.shopify-review-rating[data-product-id]')];
  const productIds = [...new Set(visibleRatings.map((node) => node.dataset.productId).filter(Boolean))];
  const ratingsById = {};
  const requests = [];
  for (let index = 0; index < productIds.length; index += 50) {
    const chunk = productIds.slice(index, index + 50);
    requests.push(fetch(`/apps/shopify-review/ratings?productIds=${chunk.join(',')}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Rating API unavailable')))
      .then((payload) => {
        Object.entries(payload.data?.ratings ?? {}).forEach(([gid, rating]) => {
          const id = String(gid).split('/').pop();
          if (id) ratingsById[id] = rating;
        });
      }));
  }
  Promise.all(requests).catch(() => {}).finally(() => {
    visibleRatings.forEach((node) => {
      if (node.isConnected) renderRating(node, ratingsById[node.dataset.productId]);
    });
  });
})();
