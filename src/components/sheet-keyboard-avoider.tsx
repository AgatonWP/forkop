import { ReactNode, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * KeyboardAvoidingView for content inside a pageSheet modal.
 *
 * React Native's version compares its own frame, measured relative to its
 * parent, against the keyboard's position on the screen. Inside a pageSheet
 * the parent starts some 50-60 pt down the screen, so the two disagree by
 * exactly that much and the bottom of the sheet stays under the keyboard —
 * which is what hid the field you were typing in. Measuring where this view
 * actually sits in the window and passing it as the offset makes the two
 * agree. Full-screen screens do not need this; plain KeyboardAvoidingView is
 * right there, as in sell.tsx.
 */
export function SheetKeyboardAvoider({ children, style }: Props) {
  const ref = useRef<View>(null);
  const [windowOffset, setWindowOffset] = useState(0);

  return (
    <View
      ref={ref}
      style={[styles.fill, style]}
      onLayout={() => ref.current?.measureInWindow((_x, y) => setWindowOffset(y))}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={windowOffset}
        style={styles.fill}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
