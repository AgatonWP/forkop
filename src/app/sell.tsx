import { useState } from 'react';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { NATIONS_LIST, getNation } from '@/lib/nations';
import {
  DealType,
  MORE_THAN_MAX_TICKET_QUANTITY,
  formatTicketQuantity,
} from '@/lib/tickets';

const TICKET_TYPES = ['Förköp', 'Eftersläpp', 'Inträde', 'Sittning', 'Gasque', 'VIP', 'Helgpass', 'Annan'];
const MAX_TICKET_PRICE = 3000;

export default function SellScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [nationId, setNationId] = useState('');
  const [customOrganizer, setCustomOrganizer] = useState('');
  const [ticketType, setTicketType] = useState(TICKET_TYPES[0]);
  const [quantity, setQuantity] = useState(1);
  const [dealType, setDealType] = useState<DealType>('sell');
  const [price, setPrice] = useState('');
  const [tradeWant, setTradeWant] = useState('');
  const [description, setDescription] = useState('');
  const [nationPickerOpen, setNationPickerOpen] = useState(false);
  const [ticketTypePickerOpen, setTicketTypePickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedNation = nationId ? getNation(nationId) : null;
  const organizerName = nationId === 'other' ? customOrganizer.trim() : (selectedNation?.name ?? '');
  const eventDisplayName = organizerName ? `${organizerName} – ${ticketType}` : '';

  const numericPrice = Number(price);
  const canSubmit =
    !!user &&
    organizerName.length > 0 &&
    (dealType === 'trade' || (numericPrice > 0 && numericPrice <= MAX_TICKET_PRICE)) &&
    !submitting;

  function handlePriceChange(value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPrice('');
      return;
    }

    setPrice(String(Math.min(Number(digits), MAX_TICKET_PRICE)));
  }

  function resetForm() {
    setNationId('');
    setCustomOrganizer('');
    setTicketType(TICKET_TYPES[0]);
    setQuantity(1);
    setDealType('sell');
    setPrice('');
    setTradeWant('');
    setDescription('');
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    const { error } = await supabase.from('listings').insert({
      user_id: user.id,
      event_name: eventDisplayName.trim(),
      ticket_type: ticketType,
      quantity,
      deal_type: dealType,
      price: dealType === 'trade' ? null : Number(price),
      trade_description: dealType === 'sell' ? null : tradeWant.trim() || null,
      description: description.trim(),
      contact_method: '',
      contact_info: '',
      nation_id: nationId,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(error.message);
      return;
    }

    resetForm();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <ThemedText style={styles.successIconText}>✓</ThemedText>
            </View>
            <ThemedText style={styles.successTitle}>Annons upplagd!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.successCopy}>
              Din annons är nu synlig för andra studenter i Lund.
            </ThemedText>
            <Pressable
              style={[styles.primaryButton, { marginTop: Spacing.four }]}
              onPress={() => {
                setSubmitted(false);
                router.push('/');
              }}>
              <ThemedText style={styles.primaryButtonText}>Lägg upp en till</ThemedText>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
          <ThemedText style={styles.headerTitle}>Lägg upp annons</ThemedText>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            keyboardShouldPersistTaps="handled">
            <View style={styles.formContainer}>
              {!user && (
                <View style={[styles.authNotice, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <ThemedText style={styles.authNoticeTitle}>Logga in först</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.authNoticeCopy}>
                    Du behöver vara inloggad för att lägga upp en annons.
                  </ThemedText>
                  <Pressable style={styles.secondaryButton} onPress={() => router.push('/explore')}>
                    <ThemedText style={styles.secondaryButtonText}>Gå till Profil</ThemedText>
                  </Pressable>
                </View>
              )}

              {/* 1. Nation / arrangör */}
              <FormSection label="1. Nation / arrangör">
                <Pressable
                  onPress={() => setNationPickerOpen(true)}
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: selectedNation ? '#E39E7273' : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    style={[
                      styles.selectButtonText,
                      !selectedNation && { color: theme.textSecondary },
                    ]}>
                    {selectedNation?.name ?? 'Välj nation eller arrangör...'}
                  </ThemedText>
                  <ThemedText style={styles.chevron} themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>

                {nationId === 'other' && (
                  <TextInput
                    value={customOrganizer}
                    onChangeText={setCustomOrganizer}
                    placeholder="Ange arrangör, t.ex. Kårhuset"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.textField,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                      },
                    ]}
                  />
                )}
              </FormSection>

              {/* 2. Ticket type */}
              <FormSection label="2. Biljettyp">
                <Pressable
                  onPress={() => setTicketTypePickerOpen(true)}
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText style={styles.selectButtonText}>{ticketType}</ThemedText>
                  <ThemedText style={styles.chevron} themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>
              </FormSection>

              {/* 3. Quantity */}
              <FormSection label="3. Antal biljetter">
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperIcon}>−</ThemedText>
                  </Pressable>
                  <View style={[styles.stepperValue, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperValueText}>
                      {formatTicketQuantity(quantity)} st
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setQuantity((q) => Math.min(MORE_THAN_MAX_TICKET_QUANTITY, q + 1))}
                    style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperIcon}>+</ThemedText>
                  </Pressable>
                </View>
              </FormSection>

              {/* 4. Deal type */}
              <FormSection label="4. Jag vill...">
                <View style={styles.segment}>
                  <SegmentButton
                    label="Sälja"
                    active={dealType === 'sell'}
                    onPress={() => setDealType('sell')}
                  />
                  <SegmentButton
                    label="Byta"
                    active={dealType === 'trade'}
                    onPress={() => setDealType('trade')}
                  />
                  <SegmentButton
                    label="Sälja eller byta"
                    active={dealType === 'both'}
                    onPress={() => setDealType('both')}
                  />
                </View>
              </FormSection>

              {/* 5. Price — shown when selling */}
              {(dealType === 'sell' || dealType === 'both') && (
                <FormSection label="5. Pris per biljett">
                  <View style={styles.priceRow}>
                    <TextInput
                      value={price}
                      onChangeText={handlePriceChange}
                      placeholder="150"
                      placeholderTextColor={theme.textSecondary}
                      keyboardType="numeric"
                      style={[
                        styles.priceInput,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                          color: theme.text,
                        },
                      ]}
                    />
                    <ThemedText style={styles.priceSuffix}>kr</ThemedText>
                  </View>
                </FormSection>
              )}

              {/* 5. Trade want — shown when trading */}
              {(dealType === 'trade' || dealType === 'both') && (
                <FormSection label="5. Vill byta mot">
                  <TextInput
                    value={tradeWant}
                    onChangeText={setTradeWant}
                    placeholder="t.ex. 2x Yran-biljetter, Sittning..."
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.textField,
                      {
                        backgroundColor: theme.backgroundElement,
                        borderColor: theme.backgroundSelected,
                        color: theme.text,
                      },
                    ]}
                  />
                </FormSection>
              )}

              {/* 6. Description */}
              <FormSection label="6. Beskrivning (valfritt)">
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Berätta mer om biljetterna, var ni kan mötas..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: theme.backgroundSelected,
                      color: theme.text,
                    },
                  ]}
                />
              </FormSection>

              {/* Submit */}
              <Pressable
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}>
                <ThemedText style={styles.primaryButtonText}>
                  {submitting ? 'Publicerar...' : 'Lägg upp annons'}
                </ThemedText>
              </Pressable>

              {submitError && (
                <ThemedText style={styles.errorText}>
                  {submitError}
                </ThemedText>
              )}

              {!canSubmit && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.validationHint}>
                  {user
                    ? `Fyll i nation/arrangör${dealType !== 'trade' ? ` och pris (max ${MAX_TICKET_PRICE} kr)` : ''} för att lägga upp.`
                    : 'Logga in för att lägga upp.'}
                </ThemedText>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Nation / arrangör picker modal */}
      <SimplePickerModal
        visible={nationPickerOpen}
        title="Nation / arrangör"
        options={NATIONS_LIST.map((nation) => ({ id: nation.id, label: nation.name }))}
        selectedId={nationId}
        onSelect={(id) => {
          setNationId(id);
          if (id !== 'other') setCustomOrganizer('');
          setNationPickerOpen(false);
        }}
        onClose={() => setNationPickerOpen(false)}
      />

      {/* Ticket type picker modal */}
      <SimplePickerModal
        visible={ticketTypePickerOpen}
        title="Biljettyp"
        options={TICKET_TYPES.map((type) => ({ id: type, label: type }))}
        selectedId={ticketType}
        onSelect={(id) => {
          setTicketType(id);
          setTicketTypePickerOpen(false);
        }}
        onClose={() => setTicketTypePickerOpen(false)}
      />
    </ThemedView>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.formSection}>
      <ThemedText style={styles.formLabel}>{label}</ThemedText>
      {children}
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SimplePickerModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { id: string; label: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable
          accessibilityLabel="Stäng"
          onPress={onClose}
          style={styles.modalBackdropPressable}
        />
        <ThemedView
          type="backgroundElement"
          style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.modalHandle} />
          <ThemedText style={styles.modalTitle}>{title}</ThemedText>
          <ScrollView style={styles.optionScroll} keyboardShouldPersistTaps="handled">
            {options.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => onSelect(opt.id)}
                style={({ pressed }) => [
                  styles.eventRow,
                  {
                    backgroundColor: selectedId === opt.id ? '#FFC8A520' : 'transparent',
                    borderColor: theme.backgroundSelected,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText style={styles.eventName}>{opt.label}</ThemedText>
                {selectedId === opt.id && (
                  <ThemedText style={styles.checkmark}>✓</ThemedText>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    shadowColor: '#E39E72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1D2430',
  },

  scrollContent: {
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
  formContainer: {
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    width: '100%',
  },
  authNotice: {
    borderRadius: 10,
    borderWidth: 1,
    gap: Spacing.two,
    padding: Spacing.three,
  },
  authNoticeTitle: {
    color: '#1D2430',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  authNoticeCopy: {
    lineHeight: 19,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EEF0F4',
    borderRadius: 8,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondaryButtonText: {
    color: '#1D2430',
    fontSize: 13,
    fontWeight: '800',
  },

  formSection: {
    gap: Spacing.two,
  },
  formLabel: {
    color: '#9F6A49',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  selectButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1D2430',
  },
  chevron: {
    fontSize: 22,
    lineHeight: 26,
  },

  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepperButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  stepperIcon: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
    color: '#1D2430',
  },
  stepperValue: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: Spacing.three,
  },
  stepperValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D2430',
  },

  segment: {
    backgroundColor: '#EEF0F4',
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 7,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: Spacing.one,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentText: {
    color: '#776B63',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#1D2430',
  },

  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  priceInput: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    minHeight: 50,
    paddingHorizontal: Spacing.three,
  },
  priceSuffix: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1D2430',
    width: 28,
  },

  textField: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 90,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },

  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 54,
    marginTop: Spacing.two,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  validationHint: {
    textAlign: 'center',
    marginTop: -Spacing.two,
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
  },

  // Modals
  modalBackdrop: {
    backgroundColor: 'rgba(29,36,48,0.28)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '78%',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: '#D5DAE2',
    borderRadius: 999,
    height: 4,
    width: 42,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1D2430',
  },
  optionScroll: {
    flexGrow: 0,
  },
  eventRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 52,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1D2430',
  },
  checkmark: {
    color: '#E39E72',
    fontSize: 18,
    fontWeight: '800',
  },

  // Success state
  successContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F6EC',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
    marginBottom: Spacing.two,
  },
  successIconText: {
    color: '#216B3A',
    fontSize: 36,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1D2430',
  },
  successCopy: {
    textAlign: 'center',
  },
});
