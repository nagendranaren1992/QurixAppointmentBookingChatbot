import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS, BRAND } from '../constants/theme';
import BrandLogo from './BrandLogo';

// ChatHeader
// Renders the Qurix logo (bundled SVG) and an online indicator.
const ChatHeader = ({ onReset }) => {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.logoWrap}>
          <BrandLogo width={32} height={32} />
        </View>
        <View>
          <Text style={styles.title}>{BRAND.name} Assistant</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Online · Book your appointment</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.iconBtn} onPress={onReset} accessibilityLabel="Restart chat">
        <Ionicons name="refresh" size={20} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    ...SHADOWS.medium,
    zIndex: 10,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  logo: {
    width: 32,
    height: 32,
  },
  title: {
    color: COLORS.white,
    fontSize: SIZES.large,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    color: COLORS.white,
    fontSize: SIZES.small,
    opacity: 0.9,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatHeader;
