import {db} from '../../db.server';
import {createMediaStorage} from './media-storage.server';
import {createTenantMediaKey, hasAllowedSignature, validateMediaMetadata} from './media-validation.server';

export async function attachReviewMedia(input: {
  shopId: string;
  reviewId: string;
  files: File[];
}) {
  if (input.files.length > 5) throw new Error('Too many media files');
  const review = await db.review.findFirst({where: {id: input.reviewId, shopId: input.shopId}, select: {id: true}});
  if (!review) throw new Error('Review not found');
  const storage = createMediaStorage();
  const created: string[] = [];
  try {
    for (const file of input.files) {
      const metadata = validateMediaMetadata({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasAllowedSignature(file.type, bytes)) throw new Error('File signature does not match its media type');
      const key = createTenantMediaKey(input.shopId, input.reviewId, file.name);
      await storage.upload({body: file, contentType: file.type, size: file.size, storageKey: key});
      const media = await db.reviewMedia.create({
        data: {
          reviewId: input.reviewId,
          type: metadata.mediaType,
          storageKey: key,
          originalName: file.name.slice(0, 255),
          contentType: file.type,
          bytes: file.size,
        },
      });
      created.push(media.id);
    }
    return created;
  } catch (error) {
    await Promise.allSettled(created.map(async (id) => {
      const media = await db.reviewMedia.findUnique({where: {id}});
      if (media) await storage.delete(media.storageKey);
      await db.reviewMedia.delete({where: {id}});
    }));
    throw error;
  }
}
