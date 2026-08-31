import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LegalDocument } from '@/lib/legal-documents';

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: document.title }} />
      <SafeAreaView
        edges={['top']}
        style={[
          styles.header,
          { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.backgroundHeader },
        ]}>
        <View style={styles.headerInner}>
          <Pressable accessibilityLabel="Tillbaka" onPress={handleBack} style={styles.backButton}>
            <ThemedText style={styles.backButtonText}>‹</ThemedText>
          </Pressable>
          <ThemedText numberOfLines={1} style={styles.headerTitle}>
            {document.title}
          </ThemedText>
        </View>
      </SafeAreaView>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.five }]}>
        <View style={styles.document}>
          <ThemedText style={styles.title}>{document.title}</ThemedText>
          {document.updatedAt && (
            <ThemedText type="small" themeColor="textSecondary">
              Senast uppdaterad: {document.updatedAt}
            </ThemedText>
          )}

          {document.introduction.map((paragraph) => (
            <ThemedText key={paragraph} selectable>{paragraph}</ThemedText>
          ))}

          {document.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
              {section.paragraphs?.map((paragraph) => (
                <ThemedText key={paragraph} selectable>{paragraph}</ThemedText>
              ))}
              {section.bullets?.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <ThemedText style={styles.bullet}>•</ThemedText>
                  <ThemedText selectable style={styles.bulletText}>{bullet}</ThemedText>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  backButton: {
    alignItems: 'center',
    borderRadius: 8,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  backButtonText: {
    fontSize: 30,
    fontWeight: '500',
    lineHeight: 30,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
  },
  document: {
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  bullet: {
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
  },
});
