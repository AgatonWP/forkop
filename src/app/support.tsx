import { LegalDocumentScreen } from '@/components/legal-document-screen';
import { supportInformation } from '@/lib/legal-documents';

export default function SupportScreen() {
  return <LegalDocumentScreen document={supportInformation} />;
}
