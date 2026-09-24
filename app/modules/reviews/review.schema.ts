import {z} from 'zod';

export const reviewSubmissionSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(5000),
  displayName: z.string().trim().max(120).optional(),
});

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;
