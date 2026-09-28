export type PlanDefinition = {
  handle: string;
  name: string;
  limits: {reviews: number; requests: number; mediaBytes: number};
  features: string[];
};

export const plans: Record<string, PlanDefinition> = {
  free: {
    handle: 'free',
    name: 'Free',
    limits: {reviews: 50, requests: 100, mediaBytes: 250 * 1024 * 1024},
    features: ['basic_widgets'],
  },
  starter: {
    handle: 'starter',
    name: 'Starter',
    limits: {reviews: 500, requests: 2000, mediaBytes: 2 * 1024 * 1024 * 1024},
    features: ['basic_widgets', 'photo_ugc'],
  },
  growth: {
    handle: 'growth',
    name: 'Growth',
    limits: {reviews: 2000, requests: 10000, mediaBytes: 10 * 1024 * 1024 * 1024},
    features: ['basic_widgets', 'photo_ugc', 'video_ugc', 'advanced_analytics'],
  },
  pro: {
    handle: 'pro',
    name: 'Pro',
    limits: {reviews: 10000, requests: 50000, mediaBytes: 50 * 1024 * 1024 * 1024},
    features: ['basic_widgets', 'photo_ugc', 'video_ugc', 'advanced_analytics', 'priority_support'],
  },
};

export function getPlan(handle: string | null | undefined) {
  return plans[handle ?? 'free'] ?? plans.free;
}
