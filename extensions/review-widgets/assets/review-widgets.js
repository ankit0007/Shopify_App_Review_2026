(function () {
  const root = document.querySelector('.shopify-review-summary[data-product-id]');
  if (!root) return;
  const productId = root.dataset.productId;
  const summary = root.querySelector('[data-review-summary]');
  const shopDomain = root.dataset.shopDomain;
  fetch(`/apps/shopify-review/api/public/products/${encodeURIComponent(productId)}/reviews?limit=1&shop=${encodeURIComponent(shopDomain)}`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('Review API unavailable')))
    .then((payload) => {
      const reviews = payload.data?.reviews ?? [];
      if (!reviews.length) {
        summary.textContent = 'No reviews yet';
        return;
      }
      const average = reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
      summary.textContent = `${average.toFixed(1)} based on customer reviews`;
    })
    .catch(() => {
      summary.textContent = '';
    });
})();
