(function () {
  const widgets = document.querySelectorAll('.shopify-review-widget[data-product-id]');

  widgets.forEach((root) => {
    const productId = root.dataset.productId;
    const summary = root.querySelector('[data-review-summary]');
    const list = root.querySelector('[data-review-list]');
    const form = root.querySelector('[data-review-form]');
    const message = root.querySelector('[data-review-message]');
    const endpoint = `/apps/shopify-review/products/${encodeURIComponent(productId)}/reviews`;

    function stars(rating) {
      const row = document.createElement('p');
      row.className = 'shopify-review-widget__stars';
      row.setAttribute('aria-label', `${rating} out of 5 stars`);
      for (let value = 1; value <= 5; value += 1) {
        const star = document.createElement('span');
        star.className = value <= rating ? 'is-filled' : 'is-empty';
        star.textContent = '★';
        row.append(star);
      }
      return row;
    }

    function render(reviews) {
      if (!list) return;
      list.replaceChildren();
      if (!reviews.length) {
        if (summary) summary.textContent = 'No reviews yet';
        return;
      }
      const average = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      if (summary) {
        summary.replaceChildren();
        summary.append(stars(Math.round(average)));
        const count = document.createElement('span');
        count.textContent = `${average.toFixed(1)} out of 5 · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`;
        summary.append(count);
      }
      reviews.forEach((review) => {
        const item = document.createElement('article');
        item.className = 'shopify-review-widget__item';
        const title = document.createElement('h3');
        title.textContent = review.displayName || 'Customer';
        const body = document.createElement('p');
        body.textContent = review.body;
        item.append(stars(Number(review.rating) || 0), title, body);
        list.append(item);
      });
    }

    fetch(`${endpoint}?limit=10`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Review API unavailable')))
      .then((payload) => render(payload.data?.reviews ?? []))
      .catch(() => {
        if (summary) summary.textContent = 'No reviews yet';
      });

    root.querySelectorAll('[data-star-picker]').forEach((picker) => {
      const input = picker.querySelector('input[name="rating"]');
      const buttons = [...picker.querySelectorAll('[data-value]')];
      const paint = (rating) => {
        buttons.forEach((button) => {
          const value = Number(button.dataset.value);
          button.classList.toggle('is-filled', value <= rating);
          button.setAttribute('aria-checked', value === rating ? 'true' : 'false');
        });
      };
      paint(Number(input?.value) || 5);
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          if (input) input.value = button.dataset.value;
          paint(Number(button.dataset.value));
        });
      });
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const body = new FormData(form);
      if (message) message.textContent = 'Sending review…';
      fetch(endpoint, {method: 'POST', body})
        .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not save review')))
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
        .catch(() => {
          if (message) message.textContent = 'The review could not be sent. Please try again.';
        });
    });
  });
})();
