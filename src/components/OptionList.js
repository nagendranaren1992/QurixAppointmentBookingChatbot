import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

// OptionList — renders selectable card options (departments, doctors, time slots, etc.)
// Props:
//   options: [{ id, title, subtitle?, meta?, icon? }]
//   onSelect: (option) => void
//   columns: 1 | 2  (default 1)
//   variant: 'card' | 'pill' (default 'card')
const OptionList = ({ options = [], onSelect, columns = 1, variant = 'card', maxHeight = 320 }) => {
  if (variant === 'pill') {
    return (
      <View style={styles.pillContainer}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={styles.pill}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
          >
            <Text style={styles.pillText}>{opt.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { maxHeight }]}
      contentContainerStyle={[
        styles.container,
        columns === 2 && styles.grid,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.card, columns === 2 && styles.cardHalf]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.7}
        >
          {opt.icon && (
            <View style={styles.iconWrap}>
              <Ionicons name={opt.icon} size={20} color={COLORS.primary} />
            </View>
          )}
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={2}>{opt.title}</Text>
            {opt.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>{opt.subtitle}</Text>
            ) : null}
            {opt.meta ? (
              <Text style={styles.meta} numberOfLines={1}>{opt.meta}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { marginHorizontal: 12, marginTop: 4 },
  container: { paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardHalf: {
    width: '48.5%',
    marginVertical: 4,
  },

  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  title: {
    fontSize: SIZES.medium,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: SIZES.small,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '500',
  },

  // Pill variant (for gender selection, etc.)
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginTop: 4,
  },
  pill: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
  },
  pillText: {
    color: COLORS.primary,
    fontSize: SIZES.medium,
    fontWeight: '600',
  },
});

export default OptionList;
