import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

// ChatInput — free-text input used inside the chat flow.
// Exposes an imperative `focus()` / `blur()` API via ref so the parent
// can re-focus the field after each bot reply.
const ChatInput = forwardRef(({
  placeholder = 'Type here...',
  onSubmit,
  keyboardType = 'default',
  maxLength,
  autoFocus = true,
  validate,
  prefix,
  // Optional transform applied on every keystroke. Useful for masks like
  // "digits only" (e.g., mobile number). Receives raw text, returns clean text.
  sanitize,
}, ref) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus?.(),
    blur: () => inputRef.current?.blur?.(),
    clear: () => setValue(''),
  }), []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (validate) {
      const err = validate(trimmed);
      if (err) { setError(err); return; }
    }
    setError(null);
    onSubmit(trimmed);
    setValue('');
  };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          error && styles.inputRowError,
        ]}
      >
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={(t) => {
            const clean = sanitize ? sanitize(t) : t;
            setValue(clean);
            if (error) setError(null);
          }}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          selectionColor={COLORS.primary}
          underlineColorAndroid="transparent"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !value.trim() && styles.sendBtnDisabled]}
          onPress={handleSubmit}
          disabled={!value.trim()}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

ChatInput.displayName = 'ChatInput';

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, marginTop: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLarge,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  inputRowFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  inputRowError: { borderColor: COLORS.error },
  prefix: {
    color: COLORS.textPrimary,
    fontSize: SIZES.large,
    marginRight: 8,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: SIZES.large,
    lineHeight: 22,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontWeight: '500',
    // RN-web: kill the default browser focus ring + caret default.
    outlineWidth: 0,
    outlineStyle: 'none',
    caretColor: COLORS.primary,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted },
  error: {
    color: COLORS.error,
    fontSize: SIZES.small,
    marginTop: 6,
    marginLeft: 14,
  },
});

export default ChatInput;
