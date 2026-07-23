// Sets user_metadata.student_verified = true - the one and only place that
// happens. Writing auth.users directly from a security-definer Postgres
// function is undocumented/unreliable on hosted Supabase, so this uses the
// officially supported Admin API instead (service-role key, auto-injected
// into every Edge Function's environment - no extra secret needed here).
//
// Never trusts the caller's word for it: re-queries student_verifications
// itself (service-role, bypassing RLS) to confirm a consumed_at row exists
// for the *authenticated* caller before writing anything.
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Inte inloggad.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: verificationRow, error: verificationError } = await adminClient
      .from('student_verifications')
      .select('lu_email, consumed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verificationError || !verificationRow?.consumed_at) {
      return new Response(JSON.stringify({ error: 'Ingen bekräftad verifiering hittades.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        student_verified: true,
        student_verified_email: verificationRow.lu_email,
      },
    });

    if (updateError) {
      console.error('apply-student-verification update error', updateError);
      return new Response(JSON.stringify({ error: 'Kunde inte spara verifieringen.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('apply-student-verification error', error);
    return new Response(JSON.stringify({ error: 'Något gick fel.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
