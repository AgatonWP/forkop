// Stateless mail relay: takes a code that request_student_verification()
// already generated and hashed server-side, and emails it via Resend. Has
// no DB access - the RPC is the source of truth for what code is valid,
// this function only ever sends mail. Requires the RESEND_API_KEY secret
// (`supabase secrets set RESEND_API_KEY=...`) and a Resend account; until
// a sending domain is verified, `onboarding@resend.dev` can send to your
// own Resend account email for testing.
import { corsHeaders } from '../_shared/cors.ts';

const LU_STUDENT_EMAIL_REGEX = /^[^\s@]+@lu\.se$/i;
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Forkop <onboarding@resend.dev>';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (typeof email !== 'string' || !LU_STUDENT_EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ error: 'Ogiltig @lu.se-mejladress.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'Ogiltig kod.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'E-postutskick är inte konfigurerat.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: 'Din verifieringskod för Forkop',
        html: `<p>Din verifieringskod är:</p><p style="font-size:28px;font-weight:800;letter-spacing:4px;">${code}</p><p>Koden gäller i 10 minuter.</p>`,
      }),
    });

    if (!resendResponse.ok) {
      const detail = await resendResponse.text();
      console.error('Resend error', resendResponse.status, detail);
      return new Response(JSON.stringify({ error: 'Kunde inte skicka mejlet. Försök igen.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-verification-email error', error);
    return new Response(JSON.stringify({ error: 'Något gick fel.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
