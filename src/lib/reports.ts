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

export type AdminReport = {
  id: string;
  listingId: string;
  listingEventName: string | null;
  listingNationId: string | null;
  reason: string;
  details?: string;
  createdAt: Date;
};

type AdminReportRow = {
  id: string;
  listing_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  listings: { event_name: string; nation_id: string } | null;
};

/** Admin-only: relies on the "Admins can view/delete reports" RLS policies. */
export async function fetchOpenReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id,listing_id,reason,details,created_at,listings(event_name,nation_id)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as AdminReportRow[]).map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    listingEventName: row.listings?.event_name ?? null,
    listingNationId: row.listings?.nation_id ?? null,
    reason: row.reason,
    details: row.details ?? undefined,
    createdAt: new Date(row.created_at),
  }));
}

export async function dismissReport(reportId: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', reportId);

  if (error) {
    throw new Error(error.message);
  }
}
