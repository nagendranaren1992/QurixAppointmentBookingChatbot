import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

// ChatInput — used for free-text inputs inside the chat flow (name, mobile, etc.)
const ChatInput = ({
  placeholder = 'Type here...',
  onSubmit,
  keyboardType = 'default',
  maxLength,
  autoFocus = true,
  validate,
  prefix,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

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
      <View style={[styles.inputRow, error && styles.inputRowError]}>
        {prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(t) => { setValue(t); if (error) setError(null); }}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
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
};

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
  inputRowError: { borderColor: COLORS.error },
  prefix: {
    color: COLORS.textSecondary,
    fontSize: SIZES.medium,
    marginRight: 6,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    fontSize: SIZES.medium,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    outlineWidth: 0, // RN web
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
