import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SheetKeyboardAvoider } from '@/components/sheet-keyboard-avoider';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import {
  LOST_ITEM_CATEGORIES,
  LOST_ITEM_CATEGORY_EMOJI,
  LOST_ITEM_CATEGORY_KEY,
  LOST_ITEM_DAYS_BACK,
  LostItem,
  LostItemCategory,
  LostItemKind,
  MAX_LOST_ITEM_DESCRIPTION,
  createLostItem,
  lostItemErrorKey,
} from '@/lib/lost-items';
import { NATIONS_LIST, getNation, listedWithoutSearch, normalizeSearchText } from '@/lib/nations';
import { formatListingEventDate, toLocalDateId } from '@/lib/tickets';

type Props = {
  visible: boolean;
  initialKind: LostItemKind;
  onClose: () => void;
  onCreated: (item: LostItem) => void;
};

export function LostItemForm({ visible, initialKind, onClose, onCreated }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { language, t } = useI18n();
  const { user } = useAuth();

  const [kind, setKind] = useState<LostItemKind>(initialKind);
  const [category, setCategory] = useState<LostItemCategory | null>(null);
  const [nationId, setNationId] = useState<string | null>(null);
  const [nationPickerOpen, setNationPickerOpen] = useState(false);
  const [happenedOn, setHappenedOn] = useState(() => toLocalDateId(new Date()));
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setKind(initialKind);
    setCategory(null);
    setNationId(null);
    setHappenedOn(toLocalDateId(new Date()));
    setDescription('');
    setError(null);
  }, [initialKind, visible]);

  // Evenings, most recent first: you report what you lost last night, not next
  // week's party.
  const dayOptions = useMemo(() => {
    const today = new Date();

    return Array.from({ length: LOST_ITEM_DAYS_BACK }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const id = toLocalDateId(date);

      return {
        id,
        label:
          index === 0
            ? t('today')
            : index === 1
              ? t('yesterdayLabel')
              : formatListingEventDate(id, language),
      };
    });
  }, [language, t]);

  const canSubmit = !!user && !!category && !!nationId && !submitting;

  async function handleSubmit() {
    if (!user || !category || !nationId || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const created = await createLostItem({
        userId: user.id,
        kind,
        category,
        nationId,
        happenedOn,
        description,
        reporterName: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? undefined,
        reporterAvatarUrl: user.user_metadata?.avatar_url ?? undefined,
      });

      onCreated(created);
    } catch (submitError) {
      setError(t(lostItemErrorKey(submitError)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <ThemedView style={styles.screen}>
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <Pressable hitSlop={12} onPress={onClose}>
            <ThemedText style={styles.headerAction}>{t('cancel')}</ThemedText>
          </Pressable>
          <ThemedText style={styles.headerTitle}>{t('lostNewTitle')}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>

        <SheetKeyboardAvoider>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.six }]}
            keyboardShouldPersistTaps="handled">
            <Segmented
              options={[
                { id: 'lost', label: t('lostKindLost') },
                { id: 'found', label: t('lostKindFound') },
              ]}
              value={kind}
              onChange={(next) => setKind(next as LostItemKind)}
            />

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>{t('lostWhatLabel')}</ThemedText>
              <View style={styles.categoryGrid}>
                {LOST_ITEM_CATEGORIES.map((option) => {
                  const active = category === option;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => setCategory(option)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: active ? '#FFC8A530' : theme.backgroundElement,
                          borderColor: active ? '#E39E72' : theme.backgroundSelected,
                        },
                      ]}>
                      <ThemedText style={styles.categoryEmoji}>
                        {LOST_ITEM_CATEGORY_EMOJI[option]}
                      </ThemedText>
                      <ThemedText type="small" style={styles.categoryLabel}>
                        {t(LOST_ITEM_CATEGORY_KEY[option])}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>{t('lostWhereLabel')}</ThemedText>
              <Pressable
                onPress={() => setNationPickerOpen(true)}
                style={[
                  styles.selectRow,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
                ]}>
                <ThemedText themeColor={nationId ? 'text' : 'textSecondary'}>
                  {nationId ? getNation(nationId).name : t('lostChooseNation')}
                </ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </Pressable>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>{t('lostWhenLabel')}</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                {dayOptions.map((option) => {
                  const active = happenedOn === option.id;

                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => setHappenedOn(option.id)}
                      style={[
                        styles.dayChip,
                        {
                          backgroundColor: active ? '#FFC8A530' : theme.backgroundElement,
                          borderColor: active ? '#E39E72' : theme.backgroundSelected,
                        },
                      ]}>
                      <ThemedText type="small" style={styles.dayChipText}>
                        {option.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>{t('lostDescriptionLabel')}</ThemedText>
              <TextInput
                maxLength={MAX_LOST_ITEM_DESCRIPTION}
                multiline
                onChangeText={setDescription}
                placeholder={t(
                  kind === 'found' ? 'lostDescriptionFoundPlaceholder' : 'lostDescriptionLostPlaceholder',
                )}
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.backgroundElement,
                    borderColor: theme.backgroundSelected,
                    color: theme.text,
                  },
                ]}
                value={description}
              />
              {kind === 'found' && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('lostFoundPrivacyHint')}
                </ThemedText>
              )}
            </View>

            {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

            <Pressable
              disabled={!canSubmit}
              onPress={handleSubmit}
              style={[styles.submitButton, { opacity: canSubmit ? 1 : 0.5 }]}>
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.submitButtonText}>{t('lostPublish')}</ThemedText>
              )}
            </Pressable>
          </ScrollView>
        </SheetKeyboardAvoider>

        <NationPicker
          visible={nationPickerOpen}
          selectedId={nationId}
          onSelect={setNationId}
          onClose={() => setNationPickerOpen(false)}
        />
      </ThemedView>
    </Modal>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((option) => {
        const active = option.id === value;

        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            style={[
              styles.segmentItem,
              active && { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText
              type="small"
              themeColor={active ? 'text' : 'textSecondary'}
              style={styles.segmentLabel}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function NationPicker({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const options = useMemo(() => {
    const normalized = normalizeSearchText(query.trim());
    if (!normalized) return NATIONS_LIST.filter((nation) => listedWithoutSearch(nation, selectedId));

    return NATIONS_LIST.filter((nation) =>
      normalizeSearchText([nation.id, nation.name, nation.shortName, ...nation.aliases].join(' ')).includes(
        normalized,
      ),
    );
  }, [query, selectedId]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.pickerBackdrop}>
        <Pressable accessibilityLabel={t('cancel')} onPress={onClose} style={StyleSheet.absoluteFill} />
        <ThemedView
          type="backgroundElement"
          style={[styles.pickerSheet, { paddingBottom: insets.bottom + Spacing.three }]}>
          <View style={styles.pickerHandle} />
          <ThemedText style={styles.fieldLabel}>{t('lostChooseNation')}</ThemedText>
          <TextInput
            onChangeText={setQuery}
            placeholder={t('nationOrganizer')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.pickerSearch,
              {
                backgroundColor: theme.background,
                borderColor: theme.backgroundSelected,
                color: theme.text,
              },
            ]}
            value={query}
          />
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickerScroll}>
            {options.map((nation) => (
              <Pressable
                key={nation.id}
                onPress={() => {
                  onSelect(nation.id);
                  onClose();
                }}
                style={[
                  styles.pickerRow,
                  {
                    borderColor: theme.backgroundSelected,
                    backgroundColor: selectedId === nation.id ? '#FFC8A520' : 'transparent',
                  },
                ]}>
                <ThemedText>{nation.name}</ThemedText>
                {selectedId === nation.id && <ThemedText>✓</ThemedText>}
              </Pressable>
            ))}
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  headerAction: {
    color: '#4F6FB7',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 56,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.three,
  },
  field: {
    gap: Spacing.two,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  segment: {
    borderRadius: 10,
    flexDirection: 'row',
    padding: 3,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    minWidth: 92,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  categoryEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  categoryLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  selectRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingHorizontal: Spacing.three,
  },
  dayRow: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dayChipText: {
    fontWeight: '600',
  },
  textArea: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 92,
    padding: Spacing.three,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#C84646',
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#1D2430',
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  pickerBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: Spacing.two,
    maxHeight: '75%',
    padding: Spacing.three,
  },
  pickerHandle: {
    alignSelf: 'center',
    backgroundColor: '#C9CFD8',
    borderRadius: 2,
    height: 4,
    marginBottom: Spacing.one,
    width: 40,
  },
  pickerSearch: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
  },
  pickerScroll: {
    flexGrow: 0,
  },
  pickerRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.two,
  },
});
