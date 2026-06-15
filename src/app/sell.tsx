import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
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
import { LundEvent, fetchLundEvents } from '@/lib/stuk-events';
import { DealType } from '@/lib/tickets';


const TICKET_TYPES = ['Inträde', 'Sittning', 'VIP', 'Helgpass', 'Gasque', 'Förköp', 'Annan'];

function getNationId(event: LundEvent | null, eventName: string) {
  const haystack = `${event?.organizer ?? ''} ${eventName}`.toLowerCase();

  if (haystack.includes('af-borgen') || haystack.includes('af borgen') || haystack.includes('t-bar')) return 'afborgen';
  if (haystack.includes('helsingkrona')) return 'helsingkrona';
  if (haystack.includes('göteborg') || haystack.includes('goteborg')) return 'goteborgs';
  if (haystack.includes('malmö') || haystack.includes('malmo')) return 'malmo';
  if (haystack.includes('västgöta') || haystack.includes('vastgota') || haystack.includes('vg')) return 'vg';
  if (haystack.includes('karneval')) return 'karneval';
  if (haystack.includes('lunds nation')) return 'lunds';

  return 'other';
}

export default function SellScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [events, setEvents] = useState<LundEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState<LundEvent | null>(null);
  const [customEventName, setCustomEventName] = useState('');
  const [ticketType, setTicketType] = useState('Inträde');
  const [quantity, setQuantity] = useState(1);
  const [dealType, setDealType] = useState<DealType>('sell');
  const [price, setPrice] = useState('');
  const [tradeWant, setTradeWant] = useState('');
  const [description, setDescription] = useState('');
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [ticketTypePickerOpen, setTicketTypePickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchLundEvents().then((data) => {
      setEvents(data);
      setEventsLoading(false);
    });
  }, []);

  const eventDisplayName = selectedEvent?.name ?? customEventName;
  const canSubmit =
    !!user &&
    eventDisplayName.trim().length > 0 &&
    (dealType === 'trade' || Number(price) > 0) &&
    !submitting;

  function resetForm() {
    setSelectedEvent(null);
    setCustomEventName('');
    setTicketType('Inträde');
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
      nation_id: getNationId(selectedEvent, eventDisplayName),
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

              {/* Event picker */}
              <FormSection label="Vilket event?">
                <Pressable
                  onPress={() => setEventPickerOpen(true)}
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: selectedEvent ? '#E39E7273' : theme.backgroundSelected,
                    },
                  ]}>
                  {eventsLoading ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <ThemedText
                      style={[
                        styles.selectButtonText,
                        !selectedEvent && !customEventName && { color: theme.textSecondary },
                      ]}>
                      {eventDisplayName || 'Välj eller sök event...'}
                    </ThemedText>
                  )}
                  <ThemedText style={styles.chevron} themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>
              </FormSection>

              {/* Ticket type */}
              <FormSection label="Biljettyp">
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

              {/* Quantity */}
              <FormSection label="Antal biljetter">
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                    style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperIcon}>−</ThemedText>
                  </Pressable>
                  <View style={[styles.stepperValue, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperValueText}>{quantity} st</ThemedText>
                  </View>
                  <Pressable
                    onPress={() => setQuantity((q) => Math.min(20, q + 1))}
                    style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.stepperIcon}>+</ThemedText>
                  </Pressable>
                </View>
              </FormSection>

              {/* Deal type */}
              <FormSection label="Jag vill...">
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

              {/* Price — shown when selling */}
              {(dealType === 'sell' || dealType === 'both') && (
                <FormSection label="Pris per biljett">
                  <View style={styles.priceRow}>
                    <TextInput
                      value={price}
                      onChangeText={setPrice}
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

              {/* Trade want — shown when trading */}
              {(dealType === 'trade' || dealType === 'both') && (
                <FormSection label="Vill byta mot">
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

              {/* Description */}
              <FormSection label="Beskrivning (valfritt)">
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
                    ? `Fyll i event${dealType !== 'trade' ? ' och pris' : ''} för att lägga upp.`
                    : 'Logga in för att lägga upp.'}
                </ThemedText>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Event picker modal */}
      <EventPickerModal
        visible={eventPickerOpen}
        events={events}
        selected={selectedEvent}
        onSelect={(event) => {
          setSelectedEvent(event);
          setCustomEventName('');
          setEventPickerOpen(false);
        }}
        onCustom={(name) => {
          setCustomEventName(name);
          setSelectedEvent(null);
          setEventPickerOpen(false);
        }}
        onClose={() => setEventPickerOpen(false)}
      />

      {/* Ticket type picker modal */}
      <SimplePickerModal
        visible={ticketTypePickerOpen}
        options={TICKET_TYPES}
        selected={ticketType}
        onSelect={(val) => {
          setTicketType(val);
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

function EventPickerModal({
  visible,
  events,
  selected,
  onSelect,
  onCustom,
  onClose,
}: {
  visible: boolean;
  events: LundEvent[];
  selected: LundEvent | null;
  onSelect: (event: LundEvent) => void;
  onCustom: (name: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.organizer ?? '').toLowerCase().includes(q)
    );
  }, [events, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onShow={() => setTimeout(() => inputRef.current?.focus(), 100)}>
      <View style={styles.modalBackdrop}>
        <ThemedView
          type="backgroundElement"
          style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Välj event</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>Stäng</ThemedText>
            </Pressable>
          </View>

          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Sök event..."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.background,
                borderColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
          />

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            style={styles.eventList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              query.trim().length > 0 ? (
                <Pressable
                  onPress={() => onCustom(query.trim())}
                  style={[styles.eventRow, styles.customEventRow, { borderColor: theme.backgroundSelected }]}>
                  <View style={styles.eventRowContent}>
                    <ThemedText style={styles.eventName}>"{query.trim()}"</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Lägg till som eget event
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.chevron} themeColor="textSecondary">›</ThemedText>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                style={({ pressed }) => [
                  styles.eventRow,
                  {
                    backgroundColor:
                      selected?.id === item.id ? '#FFC8A520' : 'transparent',
                    borderColor: theme.backgroundSelected,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <View style={styles.eventRowContent}>
                  <ThemedText style={styles.eventName}>{item.name}</ThemedText>
                  {item.organizer && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.organizer}
                    </ThemedText>
                  )}
                </View>
                {selected?.id === item.id && (
                  <ThemedText style={styles.checkmark}>✓</ThemedText>
                )}
              </Pressable>
            )}
          />
        </ThemedView>
      </View>
    </Modal>
  );
}

function SimplePickerModal({
  visible,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
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
        <ThemedView
          type="backgroundElement"
          style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Biljettyp</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>Stäng</ThemedText>
            </Pressable>
          </View>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onSelect(opt)}
              style={({ pressed }) => [
                styles.eventRow,
                {
                  backgroundColor: selected === opt ? '#FFC8A520' : 'transparent',
                  borderColor: theme.backgroundSelected,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText style={styles.eventName}>{opt}</ThemedText>
              {selected === opt && (
                <ThemedText style={styles.checkmark}>✓</ThemedText>
              )}
            </Pressable>
          ))}
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
    backgroundColor: 'rgba(0,0,0,0.40)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1D2430',
  },
  closeButton: {
    backgroundColor: '#F0F1F4',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#1D2430',
    fontSize: 13,
    fontWeight: '800',
  },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  eventList: {
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
  customEventRow: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: Spacing.one,
  },
  eventRowContent: {
    flex: 1,
    gap: 2,
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
