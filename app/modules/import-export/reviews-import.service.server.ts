import {db} from '../../db.server';
import {reviewSubmissionSchema} from '../reviews/review.schema';

export type ImportedReview = {
  productId: string;
  rating: number;
  title?: string;
  body: string;
  displayName?: string;
};

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

export function parseReviewCsv(csv: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return {rows: [] as ImportedReview[], errors: ['CSV must include a header and at least one row']};
  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const required = ['product_id', 'rating', 'body'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) return {rows: [] as ImportedReview[], errors: [`Missing columns: ${missing.join(', ')}`]};
  const rows: ImportedReview[] = [];
  const errors: string[] = [];
  for (const [lineIndex, line] of lines.slice(1).entries()) {
    const values = parseCsvLine(line);
    const value = (name: string) => values[headers.indexOf(name)]?.trim() ?? '';
    const parsed = reviewSubmissionSchema.safeParse({
      rating: value('rating'),
      title: value('title') || undefined,
      body: value('body'),
      displayName: value('display_name') || undefined,
    });
    if (!parsed.success || !value('product_id')) {
      errors.push(`Row ${lineIndex + 2} is invalid`);
      continue;
    }
    rows.push({productId: value('product_id'), ...parsed.data});
  }
  return {rows, errors};
}

export async function importReviews(shopId: string, rows: ImportedReview[]) {
  void shopId;
  void rows;
  throw new Error('Customer reviews cannot be imported or created by a merchant.');
  /*
  return db.$transaction(async (tx) => {
    let imported = 0;
    for (const row of rows) {
      const product = await tx.product.findFirst({where: {shopId, shopifyProductId: row.productId}, select: {id: true}});
      if (!product) continue;
      await tx.review.create({
        data: {
          shopId,
          productId: product.id,
          rating: row.rating,
          title: row.title,
          body: row.body,
          displayName: row.displayName,
          status: 'PENDING',
          verifiedPurchase: false,
          verificationReason: 'Imported review requires independent verification',
        },
      });
      imported += 1;
    }
    return imported;
  });
  */
}

export async function exportReviews(shopId: string) {
  const reviews = await db.review.findMany({
    where: {shopId, deletedAt: null},
    orderBy: {createdAt: 'asc'},
    select: {product: {select: {shopifyProductId: true}}, rating: true, title: true, body: true, displayName: true, verifiedPurchase: true},
  });
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    'product_id,rating,title,body,display_name,verified_purchase',
    ...reviews.map((review) => [
      review.product.shopifyProductId,
      String(review.rating),
      escape(review.title ?? ''),
      escape(review.body),
      escape(review.displayName ?? ''),
      String(review.verifiedPurchase),
    ].join(',')),
  ].join('\n');
}
