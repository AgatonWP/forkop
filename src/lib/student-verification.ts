import { supabase } from '@/lib/supabase';

export const LU_STUDENT_EMAIL_REGEX = /^[^\s@]+@lu\.se$/i;

export async function requestStudentVerification(luEmail: string): Promise<void> {
  const { data: code, error: rpcError } = await supabase.rpc('request_student_verification', {
    lu_email: luEmail,
  });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  const { error: sendError } = await supabase.functions.invoke('send-verification-email', {
    body: { email: luEmail.trim().toLowerCase(), code },
  });

  if (sendError) {
    throw new Error(sendError.message);
  }
}

export async function verifyStudentCode(code: string): Promise<void> {
  const { error: rpcError } = await supabase.rpc('verify_student_code', { code });

  if (rpcError) {
    throw new Error(rpcError.message);
  }

  const { error: applyError } = await supabase.functions.invoke('apply-student-verification');

  if (applyError) {
    throw new Error(applyError.message);
  }

  const { error: refreshError } = await supabase.auth.refreshSession();

  if (refreshError) {
    throw new Error(refreshError.message);
  }
}
