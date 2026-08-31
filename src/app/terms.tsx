import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { termsOfUse } from '@/lib/legal-documents';

export default function TermsScreen() {
  return <LegalDocumentScreen document={termsOfUse} />;
}
