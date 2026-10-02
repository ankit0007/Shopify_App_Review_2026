import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {ToggleSwitch} from './admin/ui';
import type {AdminProductChoice} from '../modules/reviews/admin-review';

type SearchData = {products?: AdminProductChoice[]; error?: string};
type CreateData = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  review?: {
    productTitle: string;
    rating: number;
    displayName: string;
    status: 'APPROVED' | 'PENDING';
    averageRating: number | null;
    reviewCount: number;
  };
};

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';
const BODY_LIMIT = 5000;

export function AddReviewDialog({open, onClose}: {open: boolean; onClose: (review?: NonNullable<CreateData['review']>) => void}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const search = useFetcher<SearchData>();
  const searchRef = useRef(search);
  searchRef.current = search;
  const create = useFetcher<CreateData>();
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminProductChoice | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<'APPROVED' | 'PENDING'>('APPROVED');
  const [featured, setFeatured] = useState(false);
  const [verifiedPurchase, setVerifiedPurchase] = useState(false);
  const reported = useRef<CreateData | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || selected || query.trim().length < 2) return;
    const term = query.trim();
    const timer = window.setTimeout(() => {
      searchRef.current.load(`/app/reviews/products?q=${encodeURIComponent(term)}`);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query, selected]);

  useEffect(() => {
    if (!create.data?.ok || !create.data.review || reported.current === create.data) return;
    reported.current = create.data;
    const review = create.data.review;
    setQuery('');
    setSelected(null);
    setRating(0);
    setTitle('');
    setBody('');
    setDisplayName('');
    setStatus('APPROVED');
    setFeatured(false);
    setVerifiedPurchase(false);
    onClose(review);
  }, [create.data, onClose]);

  const errors = create.data?.ok === false ? create.data.fieldErrors ?? {} : {};
  const message = create.data?.ok === false ? create.data.message : '';
  const shown = hover || rating;
  const products = query.trim().length < 2 ? [] : search.data?.products ?? [];

  return (
    <dialog ref={dialogRef} className="add-review" aria-labelledby={titleId} onCancel={(event) => {event.preventDefault(); onClose();}}>
      <form method="post" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        form.set('intent', 'create');
        form.set('rating', String(rating));
        form.set('productId', selected?.id ?? '');
        create.submit(form, {method: 'post'});
      }}>
        <header className="add-review__header">
          <h2 id={titleId}>Add review</h2>
          <button type="button" className="add-review__close" onClick={() => onClose()} aria-label="Close add review">Close</button>
        </header>
        {message ? <p className="add-review__alert" role="alert">{message}</p> : null}

        <fieldset className="add-review__section">
          <legend>Product</legend>
          {selected ? (
            <div className="add-review__selected">
              {selected.imageUrl ? <img src={selected.imageUrl} alt="" width={48} height={48} /> : <span className="add-review__image" aria-hidden="true" />}
              <span>
                <strong>{selected.title}</strong>
                <small>{selected.status === 'ACTIVE' ? 'Active' : selected.status}{selected.handle ? ` · ${selected.handle}` : ''}</small>
              </span>
              <button type="button" onClick={() => {setSelected(null); setQuery('');}}>Change</button>
            </div>
          ) : (
            <>
              <label htmlFor="product-search">Search products</label>
              <input
                id="product-search"
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, handle, or SKU"
                aria-invalid={errors.productId ? true : undefined}
                aria-describedby={errors.productId ? 'product-error' : undefined}
                autoComplete="off"
              />
              {errors.productId ? <p id="product-error" className="add-review__error">{errors.productId}</p> : null}
              {search.state !== 'idle' ? <p className="add-review__hint">Searching products…</p> : null}
              {search.data?.error ? <p className="add-review__error" role="alert">{search.data.error}</p> : null}
              {search.state === 'idle' && query.trim().length >= 2 && !search.data?.error && products.length === 0 ? (
                <p className="add-review__hint">No products match that search.</p>
              ) : null}
              {products.length > 0 ? (
                <ul className="add-review__results" aria-label="Product results">
                  {products.map((product) => (
                    <li key={product.id}>
                      <button type="button" className="add-review__result" onClick={() => setSelected(product)}>
                        {product.imageUrl ? <img src={product.imageUrl} alt="" width={44} height={44} /> : <span className="add-review__image" aria-hidden="true" />}
                        <span>
                          <strong>{product.title}</strong>
                          <small>
                            {product.price ? `${product.price} · ` : ''}
                            {product.status === 'ACTIVE' ? 'Active' : product.status}
                            {product.sku ? ` · SKU ${product.sku}` : ''}
                          </small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </fieldset>

        <fieldset className="add-review__section">
          <legend>Rating</legend>
          <div className="add-review__stars" role="radiogroup" aria-label="Rating" aria-invalid={errors.rating ? true : undefined}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                className="add-review__star"
                onMouseEnter={() => setHover(value)}
                onMouseLeave={() => setHover(0)}
                onFocus={() => setHover(value)}
                onBlur={() => setHover(0)}
                onClick={() => setRating(value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setRating(Math.min(5, Math.max(rating, 0) + 1));
                  }
                  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    setRating(Math.max(1, rating - 1));
                  }
                }}
              >
                <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                  <path d={STAR_PATH} fill={value <= shown ? '#F5B301' : '#D9DDE3'} />
                </svg>
              </button>
            ))}
          </div>
          <p className="add-review__hint">{rating ? `${rating} out of 5 stars selected` : 'No rating selected'}</p>
          {errors.rating ? <p className="add-review__error">{errors.rating}</p> : null}
        </fieldset>

        <label htmlFor="review-title">Review title <span>Optional</span></label>
        <input id="review-title" name="title" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} aria-invalid={errors.title ? true : undefined} />
        {errors.title ? <p className="add-review__error">{errors.title}</p> : null}

        <label htmlFor="review-body">Review text</label>
        <textarea id="review-body" name="body" value={body} maxLength={BODY_LIMIT} rows={5} required onChange={(event) => setBody(event.target.value)} aria-invalid={errors.body ? true : undefined} />
        <p className="add-review__hint">{BODY_LIMIT - body.length} characters remaining</p>
        {errors.body ? <p className="add-review__error">{errors.body}</p> : null}

        <label htmlFor="review-name">Display name</label>
        <input id="review-name" name="displayName" value={displayName} maxLength={60} required onChange={(event) => setDisplayName(event.target.value)} aria-invalid={errors.displayName ? true : undefined} />
        {errors.displayName ? <p className="add-review__error">{errors.displayName}</p> : null}

        <label htmlFor="review-status">Status</label>
        <select id="review-status" name="status" value={status} onChange={(event) => setStatus(event.target.value === 'PENDING' ? 'PENDING' : 'APPROVED')}>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
        </select>
        <p className="add-review__hint">{status === 'APPROVED' ? 'Approved reviews are included in the public rating immediately.' : 'Pending reviews stay hidden until they are approved.'}</p>

        <ToggleSwitch label="Featured" name="featured" checked={featured} onChange={setFeatured} />
        <ToggleSwitch
          label="Verified purchase"
          name="verifiedPurchase"
          value="true"
          checked={verifiedPurchase}
          onChange={setVerifiedPurchase}
          description="Leave this off unless you know this customer bought the product. It is off by default."
        />

        <footer className="add-review__footer">
          <button type="button" className="add-review__secondary" onClick={() => onClose()}>Cancel</button>
          <button type="submit" className="add-review__primary" disabled={create.state !== 'idle'}>
            {create.state === 'idle' ? 'Add review' : 'Adding review…'}
          </button>
        </footer>
      </form>
      <style>{DIALOG_CSS}</style>
    </dialog>
  );
}

const DIALOG_CSS = `
.add-review { width: min(640px, calc(100vw - 24px)); max-height: min(860px, calc(100vh - 24px)); padding: 0; border: 0; border-radius: 16px; color: #202223; }
.add-review::backdrop { background: rgba(32, 34, 35, 0.45); }
.add-review form { display: grid; gap: 8px; padding: 20px; overflow: auto; max-height: min(860px, calc(100vh - 24px)); }
.add-review__header, .add-review__footer, .add-review__selected { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.add-review h2 { margin: 0; font-size: 20px; }
.add-review label, .add-review legend { font-weight: 650; font-size: 14px; }
.add-review label span { font-weight: 500; color: #6d7175; }
.add-review input, .add-review textarea, .add-review select { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #c9cccf; border-radius: 8px; font: inherit; }
.add-review textarea { resize: vertical; }
.add-review input:focus-visible, .add-review textarea:focus-visible, .add-review select:focus-visible, .add-review button:focus-visible { outline: 2px solid #005bd3; outline-offset: 2px; }
.add-review [aria-invalid="true"] { border-color: #8e1f0b; }
.add-review__section { border: 0; margin: 0; padding: 8px 0 0; display: grid; gap: 8px; }
.add-review__results { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-height: 240px; overflow: auto; }
.add-review__result, .add-review__selected { width: 100%; text-align: left; border: 1px solid #e3e3e3; border-radius: 12px; background: #fff; padding: 8px; }
.add-review__result { display: flex; gap: 10px; align-items: center; cursor: pointer; }
.add-review__result small, .add-review__selected small, .add-review__hint, .add-review__verified { color: #6d7175; font-size: 13px; }
.add-review__result strong, .add-review__selected strong { display: block; }
.add-review__image, .add-review img { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; background: #f1f2f3; flex: 0 0 auto; }
.add-review__stars { display: flex; gap: 4px; }
.add-review__star { border: 0; background: transparent; padding: 4px; border-radius: 8px; cursor: pointer; line-height: 0; }
.add-review__error, .add-review__alert { color: #8e1f0b; background: #fff4f4; border-radius: 8px; padding: 8px 10px; margin: 0; }
.add-review__check { display: flex; align-items: center; gap: 8px; }
.add-review__check input { width: auto; }
.add-review__primary, .add-review__secondary, .add-review__close, .add-review__selected button { border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
.add-review__primary { border: 0; background: #1a1a1a; color: #fff; }
.add-review__secondary, .add-review__close, .add-review__selected button { border: 1px solid #c9cccf; background: #fff; }
@media (max-width: 640px) {
  .add-review__footer, .add-review__selected { align-items: stretch; flex-direction: column; }
  .add-review__primary, .add-review__secondary { width: 100%; }
}
`;
