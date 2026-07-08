import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { REPORT_REASONS, ReportReason, ReportTargetType, submitReport } from '@/lib/reports';
import { Listing } from '@/lib/tickets';

type Props = {
  visible: boolean;
  onClose: () => void;
  listing: Listing | null;
  /**
   * 'listing' reports only the listing itself (no target-choice step).
   * 'chat' lets the user pick between reporting the listing or the seller.
   */
  mode: 'listing' | 'chat';
};

export function ReportModal({ visible, onClose, listing, mode }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [targetType, setTargetType] = useState<ReportTargetType | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTargetType(mode === 'listing' ? 'listing' : null);
    setReason(null);
    setDetails('');
    setSubmitting(false);
    setError(null);
    setDone(false);
  }, [visible, mode]);

  if (!listing) return null;

  async function handleSubmit() {
    if (!user || !listing || !targetType || !reason || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitReport({
        reporterId: user.id,
        listingId: listing.id,
        targetType,
        reason,
        details,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte skicka rapporten.');
    } finally {
      setSubmitting(false);
    }
  }

  const showTargetStep = mode === 'chat' && !targetType;
  const title = done
    ? 'Tack för din rapport'
    : showTargetStep
      ? 'Vad vill du rapportera?'
      : targetType === 'profile'
        ? 'Rapportera användaren'
        : 'Rapportera annonsen';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Stäng" onPress={onClose} style={styles.backdropPressable} />
        <ThemedView
          type="backgroundElement"
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + Spacing.three, borderColor: theme.backgroundSelected },
          ]}>
          <View style={styles.handle} />
          <ThemedText style={styles.title}>{title}</ThemedText>

          {!user ? (
            <ThemedText type="small" themeColor="textSecondary">
              Logga in för att kunna rapportera.
            </ThemedText>
          ) : done ? (
            <ThemedText type="small" themeColor="textSecondary">
              Vi har tagit emot din rapport och granskar den så snart som möjligt.
            </ThemedText>
          ) : showTargetStep ? (
            <View style={styles.optionList}>
              <TargetOptionRow
                label="Annonsen"
                description="Fel information, olämpligt innehåll eller bluff i annonsen."
                onPress={() => setTargetType('listing')}
              />
              <TargetOptionRow
                label="Användaren"
                description="Olämpligt beteende eller meddelanden i chatten."
                onPress={() => setTargetType('profile')}
              />
            </View>
          ) : (
            <>
              <View style={styles.optionList}>
                {REPORT_REASONS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setReason(option)}
                    style={({ pressed }) => [
                      styles.reasonRow,
                      {
                        borderColor: theme.backgroundSelected,
                        backgroundColor: reason === option ? '#FFC8A520' : 'transparent',
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}>
                    <ThemedText style={styles.reasonText}>{option}</ThemedText>
                    {reason === option && <ThemedText style={styles.checkmark}>✓</ThemedText>}
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Beskriv gärna vad som hänt (valfritt)"
                placeholderTextColor={theme.textSecondary}
                multiline
                numberOfLines={3}
                style={[
                  styles.textArea,
                  { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
              />

              {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

              <Pressable
                disabled={!reason || submitting}
                onPress={handleSubmit}
                style={[styles.submitButton, (!reason || submitting) && styles.submitButtonDisabled]}>
                <ThemedText style={styles.submitButtonText}>
                  {submitting ? 'Skickar...' : 'Skicka rapport'}
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

function TargetOptionRow({
  label,
  description,
  onPress,
}: {
  label: string;
  description: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.reasonRow,
        styles.targetRow,
        { borderColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
      ]}>
      <View style={styles.targetCopy}>
        <ThemedText style={styles.reasonText}>{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <ThemedText style={styles.chevron} themeColor="textSecondary">
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(29,36,48,0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D5DAE2',
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1D2430',
  },
  optionList: {
    gap: Spacing.one,
  },
  reasonRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 52,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  reasonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D2430',
  },
  checkmark: {
    color: '#E39E72',
    fontSize: 18,
    fontWeight: '800',
  },
  targetRow: {
    minHeight: 64,
  },
  targetCopy: {
    flex: 1,
    gap: 2,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 26,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 80,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#C84646',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
