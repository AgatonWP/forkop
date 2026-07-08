import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'listing' | 'profile';

export const REPORT_REASONS = [
  'Olämpligt innehåll',
  'Bedrägeri eller skam',
  'Trakasserier',
  'Spam',
  'Annat',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export async function submitReport(params: {
  reporterId: string;
  listingId: string;
  targetType: ReportTargetType;
  reason: ReportReason;
  details?: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: params.reporterId,
    listing_id: params.listingId,
    target_type: params.targetType,
    reason: params.reason,
    details: params.details?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }
}
