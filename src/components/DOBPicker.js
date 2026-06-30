import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';
import { validateDOB, formatDate } from '../utils/validators';

// DOBPicker — date-of-birth input that uses a native HTML <input type="date"> on web
// and falls back to a plain text input (DD/MM/YYYY) on native platforms.
// In a production native build, swap the native branch for @react-native-community/datetimepicker.
const DOBPicker = ({ onSubmit }) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (raw) => {
    // Accept either YYYY-MM-DD (from web picker) or DD/MM/YYYY (typed)
    let iso = raw;
    if (raw.includes('/')) {
      const [dd, mm, yyyy] = raw.split('/');
      if (!dd || !mm || !yyyy || yyyy.length !== 4) {
        setError('Use DD/MM/YYYY format');
        return;
      }
      iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    const err = validateDOB(iso);
    if (err) { setError(err); return; }
    setError(null);
    onSubmit(iso);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <View style={[styles.inputRow, error && styles.inputRowError]}>
          <Ionicons name="calendar" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
          {/* Native HTML date input renders inside RN Web */}
          <input
            type="date"
            value={value}
            max={new Date().toISOString().split('T')[0]}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: 14,
              padding: '10px 0',
              color: COLORS.textPrimary,
              background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !value && styles.sendBtnDisabled]}
            onPress={() => value && handleSubmit(value)}
            disabled={!value}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  // Native fallback: typed date
  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, error && styles.inputRowError]}>
        <Ionicons name="calendar" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
        <TextInput
          value={value}
          onChangeText={(t) => { setValue(t); if (error) setError(null); }}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={COLORS.textMuted}
          style={styles.input}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !value && styles.sendBtnDisabled]}
          onPress={() => value && handleSubmit(value)}
          disabled={!value}
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
  input: { flex: 1, fontSize: SIZES.medium, paddingVertical: 10, color: COLORS.textPrimary },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 6,
  },
  sendBtnDisabled: { backgroundColor: COLORS.textMuted },
  error: { color: COLORS.error, fontSize: SIZES.small, marginTop: 6, marginLeft: 14 },
});

export default DOBPicker;
