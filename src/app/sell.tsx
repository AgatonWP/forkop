import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetKeyboardAvoider } from '@/components/sheet-keyboard-avoider';
import { SideSwitch } from '@/components/side-switch';
import { SingleDateCalendarModal } from '@/components/single-date-calendar-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, SecondaryHeaderHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useVerifiedOrganizers } from '@/lib/verified-organizers';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { ORGANIZERS, getNation, listedWithoutSearch } from '@/lib/nations';
import {
  DealType,
  ListingDirection,
  defaultTicketTypeFor,
  preselectedTicketTypeFor,
  ticketTypesFor,
  maxTicketQuantityFor,
  describeListingError,
  formatListingEventDate,
  formatTicketQuantity,
  toLocalDateId,
} from '@/lib/tickets';

const OTHER_TICKET_TYPE = 'Annan';
function quantityOptionsUpTo(max: number) {
  return Array.from({ length: max }, (_, index) => {
    const quantity = index + 1;
    return {
      id: String(quantity),
      label: formatTicketQuantity(quantity),
    };
  });
}
const MAX_TICKET_PRICE = 3000;
const MAX_ORGANIZER_LENGTH = 40;
const MAX_CUSTOM_TICKET_TYPE_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 1000;
const DATE_OPTION_DAYS = 180;

// On iOS this screen is a page sheet, which already starts below the status
// bar; giving it the top inset as well left a band of empty space above the
// header, and none at all put the header tight against the sheet's top edge.
// A small fixed gap sits between the two. Android shows it full screen, so
// there the inset is still needed.
const TOP_EDGES: Edge[] = Platform.OS === 'ios' ? [] : ['top'];
const SHEET_TOP_GAP = Platform.OS === 'ios' ? Spacing.two + Spacing.one : 0;

/**
 * Some organizers preselect their own ticket type — whoever picks
 * Lundakarnevalen is almost certainly selling Efterkarnevalen — and moving to
 * another organizer drops a type it does not have, back to that organizer's
 * everyday one (Förköp for a nation, Eftersläpp for a section). A free-text
 * "Annan" is always kept.
 */
function ticketTypeAfterOrganizerChange(current: string, organizerId: string) {
  if (current === OTHER_TICKET_TYPE) return current;
  const preselected = preselectedTicketTypeFor(organizerId);
  if (preselected) return preselected;
  return ticketTypesFor(organizerId).includes(current) ? current : defaultTicketTypeFor(organizerId);
}

export default function SellScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { language, t } = useI18n();
  // The + opens this as "Jag säljer", which is what it has always done. "Jag
  // söker" is preselected only when the feed sends someone here after finding
  // nothing — the moment a wanted post is what they actually need.
  const params = useLocalSearchParams<{ direction?: string }>();
  const { officialAccountNameFor } = useVerifiedOrganizers();
  const [direction, setDirection] = useState<ListingDirection>(
    params.direction === 'wanted' ? 'wanted' : 'offer',
  );
  const wanted = direction === 'wanted';
  // An official account counts its spare tickets exactly; everyone else stops
  // at "20+".
  const maxQuantity = maxTicketQuantityFor(!!user && !!officialAccountNameFor(user.id));
  const quantityOptions = useMemo(() => quantityOptionsUpTo(maxQuantity), [maxQuantity]);

  const [nationId, setNationId] = useState('');
  const [customOrganizer, setCustomOrganizer] = useState('');
  const [ticketType, setTicketType] = useState(defaultTicketTypeFor(null));
  const [customTicketType, setCustomTicketType] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dealType, setDealType] = useState<DealType>('sell');
  const [price, setPrice] = useState('');
  const [wantedNationId, setWantedNationId] = useState('');
  const [wantedCustomOrganizer, setWantedCustomOrganizer] = useState('');
  const [wantedTicketType, setWantedTicketType] = useState(defaultTicketTypeFor(null));
  const [wantedCustomTicketType, setWantedCustomTicketType] = useState('');
  const [wantedQuantity, setWantedQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [nationPickerOpen, setNationPickerOpen] = useState(false);
  const [ticketTypePickerOpen, setTicketTypePickerOpen] = useState(false);
  const [eventDatePickerOpen, setEventDatePickerOpen] = useState(false);
  const [quantityPickerOpen, setQuantityPickerOpen] = useState(false);
  const [wantedNationPickerOpen, setWantedNationPickerOpen] = useState(false);
  const [wantedTicketTypePickerOpen, setWantedTicketTypePickerOpen] = useState(false);
  const [wantedQuantityPickerOpen, setWantedQuantityPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tab screens stay mounted when you switch away, so without this the
  // "listing posted" screen would still be showing next time you come back
  // to this tab, no matter how you left it.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setSubmitted(false);
      };
    }, []),
  );

  const selectedNation = nationId ? getNation(nationId) : null;
  const organizerName = nationId === 'other' ? customOrganizer.trim() : (selectedNation?.name ?? '');
  const customTicketTypeName = customTicketType.trim();
  const effectiveTicketType =
    ticketType === 'Annan' && customTicketTypeName ? customTicketTypeName : ticketType;
  const ticketTypeReady = ticketType !== 'Annan' || customTicketTypeName.length > 0;
  const eventDisplayName = organizerName ? `${organizerName} – ${effectiveTicketType}` : '';
  const eventDateOptions = useMemo(() => {
    const today = new Date();

    return Array.from({ length: DATE_OPTION_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      const id = toLocalDateId(date);
      const formattedDate = formatListingEventDate(id, language);
      const relativeLabel = index === 0 ? t('today') : index === 1 ? t('tomorrow') : null;

      return {
        id,
        label: relativeLabel ? `${relativeLabel} · ${formattedDate}` : formattedDate,
      };
    });
  }, [language, t]);
  const selectedEventDateLabel = eventDate
    ? eventDateOptions.find((option) => option.id === eventDate)?.label ?? formatListingEventDate(eventDate, language)
    : '';
  const selectedWantedNation = wantedNationId ? getNation(wantedNationId) : null;
  const wantedOrganizerName =
    wantedNationId === 'other' ? wantedCustomOrganizer.trim() : (selectedWantedNation?.name ?? '');
  const wantedCustomTicketTypeName = wantedCustomTicketType.trim();
  const effectiveWantedTicketType =
    wantedTicketType === 'Annan' && wantedCustomTicketTypeName ? wantedCustomTicketTypeName : wantedTicketType;
  const wantedTicketTypeReady = wantedTicketType !== 'Annan' || wantedCustomTicketTypeName.length > 0;
  const tradeTargetDescription = wantedOrganizerName && wantedTicketTypeReady
    ? `${effectiveWantedTicketType} ${wantedOrganizerName} ${formatTicketQuantity(wantedQuantity)} st`
    : '';
  const tradeTargetReady =
    dealType === 'sell' || (tradeTargetDescription.length > 0 && wantedTicketTypeReady);

  const numericPrice = Number(price);
  const canSubmit =
    !!user &&
    organizerName.length > 0 &&
    ticketTypeReady &&
    eventDate.length > 0 &&
    tradeTargetReady &&
    (dealType === 'trade' || (numericPrice > 0 && numericPrice <= MAX_TICKET_PRICE)) &&
    !submitting;
  const missingDetails = [
    language === 'sv' ? 'nation/arrangör' : 'nation/organizer',
    !ticketTypeReady
      ? language === 'sv'
        ? 'egen biljettyp'
        : 'custom ticket type'
      : null,
    !eventDate
      ? language === 'sv'
        ? 'dag/datum'
        : 'day/date'
      : null,
    dealType !== 'trade'
      ? language === 'sv'
        ? `pris (max ${MAX_TICKET_PRICE} kr)`
        : `price (max ${MAX_TICKET_PRICE} SEK)`
      : null,
    dealType !== 'sell'
      ? language === 'sv'
        ? 'vad du vill byta mot'
        : 'what you want to trade for'
      : null,
  ].filter(Boolean);
  const validationHint = user
    ? language === 'sv'
      ? `Fyll i ${missingDetails.join(', ')} för att lägga upp.`
      : `Fill in ${missingDetails.join(', ')} to post.`
    : t('loginToPostHint');

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
    setTicketType(defaultTicketTypeFor(null));
    setCustomTicketType('');
    setEventDate('');
    setQuantity(1);
    setDealType('sell');
    setPrice('');
    setWantedNationId('');
    setWantedCustomOrganizer('');
    setWantedTicketType(defaultTicketTypeFor(null));
    setWantedCustomTicketType('');
    setWantedQuantity(1);
    setDescription('');
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!user || !canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    const { error } = await supabase.from('listings').insert({
      user_id: user.id,
      // Left out for offers: the column defaults to 'offer', and omitting it
      // keeps posting working against a database the wanted-posts migration
      // has not reached yet.
      ...(direction === 'wanted' ? { direction } : {}),
      event_name: eventDisplayName.trim(),
      ticket_type: effectiveTicketType,
      event_date: eventDate,
      quantity,
      deal_type: dealType,
      price: dealType === 'trade' ? null : Number(price),
      trade_description: dealType === 'sell' ? null : tradeTargetDescription,
      description: description.trim(),
      contact_method: '',
      contact_info: '',
      nation_id: nationId,
      seller_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? null,
      seller_avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    setSubmitting(false);

    if (error) {
      setSubmitError(describeListingError(error, t));
      return;
    }

    resetForm();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <ThemedView style={styles.screen}>
        <SafeAreaView style={styles.safeArea} edges={[...TOP_EDGES, 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.successScrollContent}
            showsVerticalScrollIndicator={false}>
            <SuccessState
              onPostAnother={() => {
                setSubmitted(false);
              }}
              onGoHome={() => {
                setSubmitted(false);
                router.back();
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        edges={TOP_EDGES}
        style={[styles.header, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader }]}>
        <View style={[styles.headerInner, { marginTop: SHEET_TOP_GAP }]}>
          {/* Presented as a modal rather than a tab, so it needs its own way out. */}
          <Pressable hitSlop={12} onPress={() => router.back()} style={styles.headerCancel}>
            <ThemedText style={styles.headerCancelText}>{t('cancel')}</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('postListing')}</ThemedText>
          <View style={styles.headerCancel} />
        </View>
      </SafeAreaView>

      <SheetKeyboardAvoider>
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
                  <ThemedText style={styles.authNoticeTitle}>{t('loginFirst')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.authNoticeCopy}>
                    {t('loginToPost')}
                  </ThemedText>
                  <Pressable style={styles.secondaryButton} onPress={() => router.push('/explore')}>
                    <ThemedText style={styles.secondaryButtonText}>{t('goToProfile')}</ThemedText>
                  </Pressable>
                </View>
              )}

              {/* The same switch as Köp | Sälj on Hitta, full width here. */}
              <SideSwitch
                options={[
                  { id: 'offer', label: t('iSell') },
                  { id: 'wanted', label: t('iSeek') },
                ]}
                value={direction}
                onChange={setDirection}
                style={styles.directionSwitch}
              />

              {/* 1. Nation / arrangör */}
              <FormSection label={t('nationOrganizer')}>
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
                    {selectedNation?.name ?? t('chooseNationOrganizer')}
                  </ThemedText>
                  <ThemedText style={styles.chevron} themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>

                {nationId === 'other' && (
                  <TextInput
                    value={customOrganizer}
                    maxLength={MAX_ORGANIZER_LENGTH}
                    onChangeText={setCustomOrganizer}
                    placeholder={t('organizerPlaceholder')}
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

              <View style={styles.inlineFields}>
                <View style={styles.ticketTypeField}>
                  <FormSection label={t('ticketType')}>
                    <Pressable
                      onPress={() => setTicketTypePickerOpen(true)}
                      style={[
                        styles.selectButton,
                        {
                          backgroundColor: theme.backgroundElement,
                          borderColor: theme.backgroundSelected,
                        },
                      ]}>
                      <ThemedText numberOfLines={1} style={styles.selectButtonText}>{effectiveTicketType}</ThemedText>
                      <ThemedText style={styles.chevron} themeColor="textSecondary">
                        ›
                      </ThemedText>
                    </Pressable>
                  </FormSection>
                </View>

                <View style={styles.quantityField}>
                  <FormSection label={t('quantity')}>
                    <View style={styles.stepper}>
                      <Pressable
                        onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                        style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText style={styles.stepperIcon}>−</ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setQuantityPickerOpen(true)}
                        style={[styles.stepperValue, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText style={styles.stepperValueText}>
                          {formatTicketQuantity(quantity)}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                        style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText style={styles.stepperIcon}>+</ThemedText>
                      </Pressable>
                    </View>
                  </FormSection>
                </View>
              </View>

              <FormSection label={t('ticketDate')}>
                <Pressable
                  onPress={() => setEventDatePickerOpen(true)}
                  style={[
                    styles.selectButton,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: eventDate ? '#E39E7273' : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    numberOfLines={1}
                    style={[
                      styles.selectButtonText,
                      !eventDate && { color: theme.textSecondary },
                    ]}>
                    {selectedEventDateLabel || t('chooseTicketDate')}
                  </ThemedText>
                  <ThemedText style={styles.chevron} themeColor="textSecondary">
                    ›
                  </ThemedText>
                </Pressable>
              </FormSection>

              {/* 4. Deal type */}
              <FormSection label={t('iWantTo')}>
                <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
                  <SegmentButton
                    label={wanted ? t('buyAction') : t('sellAction')}
                    active={dealType === 'sell'}
                    onPress={() => setDealType('sell')}
                  />
                  <SegmentButton
                    label={t('tradeAction')}
                    active={dealType === 'trade'}
                    onPress={() => setDealType('trade')}
                  />
                  <SegmentButton
                    label={wanted ? t('buyOrTrade') : t('sellOrTrade')}
                    active={dealType === 'both'}
                    onPress={() => setDealType('both')}
                  />
                </View>

                <View style={styles.dealFollowUp}>
                  {(dealType === 'sell' || dealType === 'both') && (
                    <View style={styles.followUpSection}>
                      <ThemedText style={styles.formLabel}>{t('forLabel')}</ThemedText>
                      <View style={styles.priceRow}>
                        <TextInput
                          value={price}
                          onChangeText={handlePriceChange}
                          placeholder={t('price')}
                          placeholderTextColor={theme.textSecondary}
                          keyboardType="numeric"
                          style={[
                            styles.priceInput,
                            !price && styles.priceInputPlaceholder,
                            {
                              backgroundColor: theme.backgroundElement,
                              borderColor: theme.backgroundSelected,
                              color: theme.text,
                            },
                          ]}
                        />
                        <ThemedText style={styles.priceSuffix}>{t('currencyPerTicket')}</ThemedText>
                      </View>
                    </View>
                  )}

                  {(dealType === 'trade' || dealType === 'both') && (
                    <View style={styles.followUpSection}>
                      <ThemedText style={styles.formLabel}>
                        {wanted ? t('canOfferLabel') : t('againstLabel')}
                      </ThemedText>
                      <View style={styles.tradeTargetBox}>
                        <View style={styles.inlineFields}>
                          <View style={styles.ticketTypeField}>
                            <Pressable
                              onPress={() => setWantedTicketTypePickerOpen(true)}
                              style={[
                                styles.selectButton,
                                {
                                  backgroundColor: theme.backgroundElement,
                                  borderColor: theme.backgroundSelected,
                                },
                              ]}>
                              <ThemedText numberOfLines={1} style={styles.selectButtonText}>
                                {effectiveWantedTicketType}
                              </ThemedText>
                              <ThemedText style={styles.chevron} themeColor="textSecondary">
                                ›
                              </ThemedText>
                            </Pressable>
                          </View>

                          <View style={styles.quantityField}>
                            <View style={styles.stepper}>
                              <Pressable
                                onPress={() => setWantedQuantity((q) => Math.max(1, q - 1))}
                                style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                                <ThemedText style={styles.stepperIcon}>−</ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => setWantedQuantityPickerOpen(true)}
                                style={[styles.stepperValue, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                                <ThemedText style={styles.stepperValueText}>
                                  {formatTicketQuantity(wantedQuantity)}
                                </ThemedText>
                              </Pressable>
                              <Pressable
                                onPress={() => setWantedQuantity((q) => Math.min(maxQuantity, q + 1))}
                                style={[styles.stepperButton, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                                <ThemedText style={styles.stepperIcon}>+</ThemedText>
                              </Pressable>
                            </View>
                          </View>
                        </View>

                        <Pressable
                          onPress={() => setWantedNationPickerOpen(true)}
                          style={[
                            styles.selectButton,
                            {
                              backgroundColor: theme.backgroundElement,
                              borderColor: selectedWantedNation ? '#E39E7273' : theme.backgroundSelected,
                            },
                          ]}>
                          <ThemedText
                            numberOfLines={1}
                            style={[
                              styles.selectButtonText,
                              !selectedWantedNation && { color: theme.textSecondary },
                            ]}>
                            {selectedWantedNation?.name ?? t('chooseNationOrganizer')}
                          </ThemedText>
                          <ThemedText style={styles.chevron} themeColor="textSecondary">
                            ›
                          </ThemedText>
                        </Pressable>

                        {wantedNationId === 'other' && (
                          <TextInput
                            value={wantedCustomOrganizer}
                            maxLength={MAX_ORGANIZER_LENGTH}
                            onChangeText={setWantedCustomOrganizer}
                            placeholder={t('organizerPlaceholder')}
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

                        {!!tradeTargetDescription && (
                          <ThemedText style={styles.tradeTargetPreview}>
                            {tradeTargetDescription}
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              </FormSection>

              {/* 6. Description */}
              <FormSection label={t('optionalDescription')}>
                <TextInput
                  value={description}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onChangeText={setDescription}
                  placeholder={t('descriptionPlaceholder')}
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
                  {submitting ? t('posting') : t('postButton')}
                </ThemedText>
              </Pressable>

              {submitError && (
                <ThemedText style={styles.errorText}>
                  {submitError}
                </ThemedText>
              )}

              {!canSubmit && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.validationHint}>
                  {validationHint}
                </ThemedText>
              )}
          </View>
        </ScrollView>
      </SheetKeyboardAvoider>

      {/* Nation / arrangör picker modal */}
      <SimplePickerModal
        visible={nationPickerOpen}
        title={t('nationOrganizer')}
        options={ORGANIZER_OPTIONS}
        selectedId={nationId}
        onSelect={(id) => {
          setNationId(id);
          if (id !== 'other') setCustomOrganizer('');
          setTicketType((current) => ticketTypeAfterOrganizerChange(current, id));
          setNationPickerOpen(false);
        }}
        onClose={() => setNationPickerOpen(false)}
      />

      {/* Ticket type picker modal */}
      <SimplePickerModal
        visible={ticketTypePickerOpen}
        title={t('ticketType')}
        options={[...ticketTypesFor(nationId), OTHER_TICKET_TYPE].map((type) => ({ id: type, label: type }))}
        selectedId={ticketType}
        onSelect={(id) => {
          setTicketType(id);
          if (id !== 'Annan') setCustomTicketType('');
          if (id !== 'Annan') setTicketTypePickerOpen(false);
        }}
        customOptionId="Annan"
        customLabel={t('otherTypeLabel')}
        customValue={customTicketType}
        onCustomValueChange={setCustomTicketType}
        onClose={() => setTicketTypePickerOpen(false)}
      />

      <SimplePickerModal
        visible={quantityPickerOpen}
        title={t('ticketQuantity')}
        options={quantityOptions}
        selectedId={String(quantity)}
        onSelect={(id) => {
          setQuantity(Number(id));
          setQuantityPickerOpen(false);
        }}
        onClose={() => setQuantityPickerOpen(false)}
      />

      <SingleDateCalendarModal
        visible={eventDatePickerOpen}
        selectedDate={eventDate || null}
        minDateId={eventDateOptions[0]?.id}
        maxDateId={eventDateOptions[eventDateOptions.length - 1]?.id}
        onSelect={setEventDate}
        onClose={() => setEventDatePickerOpen(false)}
      />

      <SimplePickerModal
        visible={wantedTicketTypePickerOpen}
        title={t('ticketType')}
        options={[...ticketTypesFor(wantedNationId), OTHER_TICKET_TYPE].map((type) => ({ id: type, label: type }))}
        selectedId={wantedTicketType}
        onSelect={(id) => {
          setWantedTicketType(id);
          if (id !== 'Annan') setWantedCustomTicketType('');
          if (id !== 'Annan') setWantedTicketTypePickerOpen(false);
        }}
        customOptionId="Annan"
        customLabel={t('otherTypeLabel')}
        customValue={wantedCustomTicketType}
        onCustomValueChange={setWantedCustomTicketType}
        onClose={() => setWantedTicketTypePickerOpen(false)}
      />

      <SimplePickerModal
        visible={wantedQuantityPickerOpen}
        title={t('ticketQuantity')}
        options={quantityOptions}
        selectedId={String(wantedQuantity)}
        onSelect={(id) => {
          setWantedQuantity(Number(id));
          setWantedQuantityPickerOpen(false);
        }}
        onClose={() => setWantedQuantityPickerOpen(false)}
      />

      <SimplePickerModal
        visible={wantedNationPickerOpen}
        title={t('nationOrganizer')}
        options={ORGANIZER_OPTIONS}
        selectedId={wantedNationId}
        onSelect={(id) => {
          setWantedNationId(id);
          if (id !== 'other') setWantedCustomOrganizer('');
          setWantedTicketType((current) => ticketTypeAfterOrganizerChange(current, id));
          setWantedNationPickerOpen(false);
        }}
        onClose={() => setWantedNationPickerOpen(false)}
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
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentButton, active && { backgroundColor: theme.backgroundElement }]}>
      <ThemedText
        style={styles.segmentText}
        themeColor={active ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SuccessState({
  onPostAnother,
  onGoHome,
}: {
  onPostAnother: () => void;
  onGoHome: () => void;
}) {
  const { t } = useI18n();
  const iconAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const copyAnim = useRef(new Animated.Value(0)).current;
  const buttonAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(iconAnim, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 12,
        speed: 13,
      }),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(copyAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [buttonAnim, copyAnim, iconAnim, titleAnim]);

  const fadeUpStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  });

  return (
    <View style={styles.successContainer}>
      <Animated.View
        style={[
          styles.successIconOuter,
          {
            opacity: iconAnim,
            transform: [
              { scale: iconAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) },
            ],
          },
        ]}>
        <View style={styles.successIconGlow} />
        <View style={styles.successIcon}>
          <ThemedText style={styles.successIconText}>✓</ThemedText>
        </View>
      </Animated.View>

      <Animated.View style={fadeUpStyle(titleAnim)}>
        <ThemedText style={styles.successTitle}>{t('listingPosted')}</ThemedText>
      </Animated.View>

      <Animated.View style={fadeUpStyle(copyAnim)}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.successCopy}>
          {t('listingPostedCopy')}
        </ThemedText>
      </Animated.View>

      <Animated.View style={[fadeUpStyle(buttonAnim), styles.successButtonWrap]}>
        <Pressable style={styles.primaryButton} onPress={onPostAnother}>
          <ThemedText style={styles.primaryButtonText}>{t('postAnother')}</ThemedText>
        </Pressable>
        <Pressable style={styles.successSecondaryButton} onPress={onGoHome}>
          <ThemedText style={styles.successSecondaryButtonText}>{t('goToHome')}</ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

type PickerOption = { id: string; label: string; searchTerms?: string[]; searchOnly?: boolean };

const ORGANIZER_OPTIONS: PickerOption[] = ORGANIZERS.map((nation) => ({
  id: nation.id,
  label: nation.name,
  searchTerms: [nation.shortName, ...nation.aliases],
  searchOnly: nation.searchOnly,
}));

function normalizePickerSearch(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function SimplePickerModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  customOptionId,
  customLabel,
  customValue,
  onCustomValueChange,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  customOptionId?: string;
  customLabel?: string;
  customValue?: string;
  onCustomValueChange?: (value: string) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const searchable = options.some((option) => option.searchTerms?.length);

  useEffect(() => {
    if (visible) {
      setQuery('');
    }
  }, [visible]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizePickerSearch(query.trim());
    if (!normalizedQuery) return options.filter((option) => listedWithoutSearch(option, selectedId));

    return options.filter((option) =>
      normalizePickerSearch([option.id, option.label, ...(option.searchTerms ?? [])].join(' ')).includes(normalizedQuery),
    );
  }, [options, query, selectedId]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        style={styles.modalBackdrop}>
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
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('nationOrganizer')}
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
          )}
          <ScrollView style={styles.optionScroll} keyboardShouldPersistTaps="handled">
            {filteredOptions.map((opt) => {
              if (opt.id === customOptionId && onCustomValueChange) {
                return (
                  <View
                    key={opt.id}
                    style={[
                      styles.eventRow,
                      styles.customOptionRow,
                      {
                        backgroundColor: selectedId === opt.id ? '#FFC8A520' : 'transparent',
                        borderColor: theme.backgroundSelected,
                      },
                    ]}>
                    <ThemedText style={styles.customOptionLabel}>
                      {customLabel ?? opt.label}
                    </ThemedText>
                    <TextInput
                      value={customValue ?? ''}
                      maxLength={MAX_CUSTOM_TICKET_TYPE_LENGTH}
                      onFocus={() => {
                        if (selectedId !== opt.id) onSelect(opt.id);
                      }}
                      onChangeText={(value) => {
                        if (selectedId !== opt.id) onSelect(opt.id);
                        onCustomValueChange(value);
                      }}
                      onSubmitEditing={onClose}
                      returnKeyType="done"
                      placeholder=""
                      placeholderTextColor={theme.textSecondary}
                      style={[
                        styles.customOptionInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.backgroundSelected,
                          color: theme.text,
                        },
                      ]}
                    />
                    {selectedId === opt.id && (
                      <ThemedText style={styles.checkmark}>✓</ThemedText>
                    )}
                  </View>
                );
              }

              return (
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
              );
            })}
            {filteredOptions.length === 0 && (
              <View style={[styles.emptyOptionRow, { borderColor: theme.backgroundSelected }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('emptyMatches')}
                </ThemedText>
              </View>
            )}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },

  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowColor: '#E39E72',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  headerInner: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: SecondaryHeaderHeight,
    paddingHorizontal: Spacing.three,
  },
  headerCancel: {
    justifyContent: 'center',
    minWidth: 64,
  },
  headerCancelText: {
    color: '#4F6FB7',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
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
  inlineFields: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  ticketTypeField: {
    flex: 1,
    minWidth: 0,
  },
  quantityField: {
    width: 164,
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
  },
  chevron: {
    fontSize: 22,
    lineHeight: 26,
  },

  stepper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  stepperButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 40,
  },
  stepperIcon: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  stepperValue: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    minWidth: 72,
    paddingHorizontal: Spacing.two,
  },
  stepperValueText: {
    fontSize: 15,
    fontWeight: '800',
  },

  directionSwitch: {
    height: 46,
  },
  segment: {
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
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  dealFollowUp: {
    gap: Spacing.three,
    paddingTop: Spacing.one,
  },
  followUpSection: {
    gap: Spacing.two,
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
  priceInputPlaceholder: {
    fontSize: 16,
    fontWeight: '600',
  },
  priceSuffix: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    width: 72,
  },
  tradeTargetBox: {
    gap: Spacing.two,
  },
  tradeTargetPreview: {
    color: '#9F6A49',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
  },
  searchInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
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
  customOptionRow: {
    minHeight: 58,
  },
  customOptionLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  customOptionInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    minHeight: 40,
    paddingHorizontal: Spacing.two,
  },
  emptyOptionRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
  },
  checkmark: {
    color: '#E39E72',
    fontSize: 18,
    fontWeight: '800',
  },

  // Success state
  successScrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
  },
  successContainer: {
    alignItems: 'center',
    gap: Spacing.two,
    overflow: 'visible',
  },
  successIconOuter: {
    alignItems: 'center',
    height: 128,
    justifyContent: 'center',
    marginBottom: Spacing.two,
    overflow: 'visible',
    width: 128,
  },
  successIconGlow: {
    backgroundColor: '#E8F6EC',
    borderRadius: 56,
    height: 112,
    position: 'absolute',
    width: 112,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: '#CFEED9',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  successIconText: {
    color: '#216B3A',
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    textAlign: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 36,
    textAlign: 'center',
  },
  successCopy: {
    textAlign: 'center',
  },
  successButtonWrap: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  successSecondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  successSecondaryButtonText: {
    color: '#776B63',
    fontSize: 14,
    fontWeight: '800',
  },
});
