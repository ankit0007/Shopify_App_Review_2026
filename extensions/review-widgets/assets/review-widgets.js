(function () {
  if (window.__productReviewsMounted) return;
  window.__productReviewsMounted = true;

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

  const found = [...document.querySelectorAll('.shopify-review-widget[data-product-id]')].map((element, index) => {
    element.dataset.widgetId = element.dataset.widgetId || `review-widget-${index}`;
    return {id: element.dataset.widgetId, productId: element.dataset.productId, placement: element.dataset.placement || 'section', element};
  });
  const remove = new Set(widgetsToRemove(found));
  found.forEach((widget) => {
    if (remove.has(widget.id)) widget.element.remove();
  });

  document.querySelectorAll('.shopify-review-widget[data-product-id]').forEach((root) => {
    const productId = root.dataset.productId;
    const summary = root.querySelector('[data-review-summary]');
    const list = root.querySelector('[data-review-list]');
    const form = root.querySelector('[data-review-form]');
    const message = root.querySelector('[data-review-message]');
    const loadMore = root.querySelector('[data-load-more]');
    const perPage = Math.min(Math.max(Number(root.dataset.perPage) || 5, 1), 10);
    const showName = root.dataset.showName !== 'false';
    const showDate = root.dataset.showDate !== 'false';
    const showVerified = root.dataset.showVerified !== 'false';
    const emptyMessage = root.dataset.emptyMessage || 'No reviews yet';
    const endpoint = `/apps/shopify-review/products/${encodeURIComponent(productId)}/reviews`;
    let cursor = null;

    function stars(rating) {
      const row = document.createElement('p');
      row.className = 'shopify-review-widget__stars';
      row.setAttribute('aria-label', `${rating} out of 5 stars`);
      for (let value = 1; value <= 5; value += 1) {
        const star = document.createElement('span');
        star.className = value <= rating ? 'is-filled' : 'is-empty';
        star.textContent = 'â˜…';
        row.append(star);
      }
      return row;
    }

    function render(reviews, averageValue, totalValue, append) {
      if (!list) return;
      if (!append) list.replaceChildren();
      if (!reviews.length && !append) {
        if (summary) summary.textContent = emptyMessage;
        return;
      }
      if (summary && Number.isFinite(averageValue)) {
        summary.replaceChildren();
        summary.append(stars(Math.round(averageValue)));
        const count = document.createElement('span');
        const total = Number.isFinite(totalValue) ? totalValue : reviews.length;
        count.textContent = `${averageValue.toFixed(1)} out of 5 Â· ${total} review${total === 1 ? '' : 's'}`;
        summary.append(count);
      }
      reviews.forEach((review) => {
        const item = document.createElement('article');
        item.className = 'shopify-review-widget__item';
        const title = document.createElement('h3');
        title.textContent = review.title || 'Review';
        const body = document.createElement('p');
        body.textContent = review.body;
        const meta = document.createElement('small');
        const parts = [];
        if (showName) parts.push(review.displayName || 'Customer');
        if (showVerified && review.verifiedPurchase) parts.push('Verified purchase');
        if (showDate && review.submittedAt) parts.push(new Date(review.submittedAt).toLocaleDateString());
        meta.textContent = parts.join(' Â· ');
        item.append(stars(Number(review.rating) || 0), title, meta, body);
        list.append(item);
      });
    }

    function load(nextCursor) {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('limit', String(perPage));
      if (nextCursor) url.searchParams.set('cursor', nextCursor);
      return fetch(`${url.pathname}${url.search}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Review API unavailable')))
        .then((payload) => {
          const reviews = payload.data?.reviews ?? [];
          cursor = payload.data?.nextCursor ?? null;
          render(reviews, payload.data?.averageRating, payload.data?.totalReviews, Boolean(nextCursor));
          if (loadMore) loadMore.hidden = !cursor;
        })
        .catch(() => {
          if (summary && !nextCursor) summary.textContent = emptyMessage;
        });
    }

    load(null);
    loadMore?.addEventListener('click', () => {
      if (cursor) load(cursor);
    });

    root.querySelectorAll('[data-star-picker]').forEach((picker) => {
      const input = picker.querySelector('input[name="rating"]');
      const buttons = [...picker.querySelectorAll('[data-value]')];
      const paint = (rating) => {
        buttons.forEach((button) => {
          const value = Number(button.dataset.value);
          button.classList.toggle('is-filled', value <= rating);
          button.setAttribute('aria-checked', value === rating ? 'true' : 'false');
          button.tabIndex = value === rating ? 0 : -1;
        });
      };
      paint(Number(input?.value) || 5);
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          if (input) input.value = button.dataset.value;
          paint(Number(button.dataset.value));
        });
        button.addEventListener('keydown', (event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const current = Number(input?.value) || 5;
          const next = event.key === 'Home' ? 1 : event.key === 'End' ? 5 :
            Math.min(5, Math.max(1, current + (event.key === 'ArrowRight' ? 1 : -1)));
          if (input) input.value = String(next);
          paint(next);
          buttons[next - 1]?.focus();
        });
      });
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      if (submit?.disabled) return;
      const body = new FormData(form);
      if (!String(body.get('body') || '').trim() || !body.get('rating')) {
        if (message) message.textContent = 'Enter a rating and a review.';
        return;
      }
      if (submit) submit.disabled = true;
      if (message) message.textContent = 'Sending reviewâ€¦';
      fetch(endpoint, {method: 'POST', body})
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          if (!response.ok) throw new Error(payload?.error?.message || 'Could not save review');
          return payload;
        })
        .then(() => {
          form.reset();
          root.querySelectorAll('[data-star-picker]').forEach((picker) => {
            const input = picker.querySelector('input[name="rating"]');
            if (input) input.value = '5';
            picker.querySelectorAll('[data-value]').forEach((button) => {
              button.classList.toggle('is-filled', Number(button.dataset.value) <= 5);
            });
          });
          if (message) message.textContent = 'Thank you. Your review was sent for approval.';
        })
        .catch((error) => {
          if (message) message.textContent = error instanceof Error ? error.message : 'The review could not be sent. Please try again.';
        })
        .finally(() => {
          if (submit) submit.disabled = false;
        });
    });
  });
})();
