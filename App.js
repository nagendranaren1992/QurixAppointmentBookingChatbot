import React, { useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, useWindowDimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import ChatBot from './src/components/ChatBot';
import BrandLogo from './src/components/BrandLogo';
import { COLORS, SIZES, SHADOWS, BRAND } from './src/constants/theme';

// =================================================================
// Web-only CSS overrides
// react-native-web compiles StyleSheets into hashed atomic classes
// (e.g. `r-backgroundColor-1igom6c`). Override them by injecting a
// stylesheet at runtime. NOTE: these class hashes are produced from
// the source color value — if the source value changes (or you
// upgrade react-native-web), the hash may change too.
// =================================================================
const WEB_CSS_OVERRIDES = `
  .r-backgroundColor-1igom6c { background-color: #14bbd3 !important; }
`;

const useInjectWebStyles = () => {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const id = 'qurix-web-css-overrides';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = WEB_CSS_OVERRIDES;
    document.head.appendChild(style);
  }, []);
};

// App entry — wraps the chatbot in a responsive layout.
// On desktop/web (width >= 900) it shows a dashboard with branded sidebar.
// On mobile widths it shows the chatbot full-screen.
export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  useInjectWebStyles();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      {isDesktop ? (
        <View style={styles.dashboard}>
          {/* Sidebar / branding panel */}
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandLogo}>
                <BrandLogo width={32} height={32} />
              </View>
              <View>
                <Text style={styles.brandName}>{BRAND.name}</Text>
                <Text style={styles.brandTag}>{BRAND.tagline}</Text>
              </View>
            </View>

            <View style={styles.heroBlock}>
              <Text style={styles.heroTitle}>Book Your Doctor Appointment in Minutes</Text>
              <Text style={styles.heroDesc}>
                Chat with our healthcare assistant to find the right specialist,
                pick a convenient time, and confirm your visit — all in one place.
              </Text>
            </View>

            <View style={styles.featureList}>
              <Feature icon="flash" title="Instant booking" desc="No phone calls, no waiting." />
              <Feature icon="people" title="500+ specialists" desc="Across multiple departments." />
              <Feature icon="shield-checkmark" title="Secure & private" desc="Your data is fully encrypted." />
              <Feature icon="time" title="24/7 available" desc="Book any time, day or night." />
            </View>

            <View style={styles.contactBlock}>
              <Text style={styles.contactTitle}>Need help?</Text>
              <View style={styles.contactRow}>
                <Ionicons name="call" size={14} color={COLORS.white} />
                <Text style={styles.contactText}>{BRAND.supportPhone}</Text>
              </View>
              <View style={styles.contactRow}>
                <Ionicons name="mail" size={14} color={COLORS.white} />
                <Text style={styles.contactText}>{BRAND.supportEmail}</Text>
              </View>
            </View>
          </View>

          {/* Chat panel */}
          <View style={styles.chatPanel}>
            <View style={styles.chatWindow}>
              <ChatBot />
            </View>
          </View>
        </View>
      ) : (
        // Mobile / narrow view — chatbot full-screen
        <View style={{ flex: 1 }}>
          <ChatBot />
        </View>
      )}
    </SafeAreaView>
  );
}

const Feature = ({ icon, title, desc }) => (
  <View style={styles.feature}>
    <View style={styles.featureIcon}>
      <Ionicons name={icon} size={16} color={COLORS.white} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  dashboard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.background,
  },

  sidebar: {
    width: '40%',
    maxWidth: 480,
    backgroundColor: COLORS.primary,
    padding: 36,
    justifyContent: 'space-between',
  },

  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandLogo: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
    ...SHADOWS.small,
  },
  brandName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandTag: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: SIZES.small,
    marginTop: 2,
  },

  heroBlock: { marginTop: 40 },
  heroTitle: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: SIZES.medium,
    lineHeight: 22,
    marginTop: 14,
  },

  featureList: { marginTop: 30 },
  feature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  featureIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  featureTitle: {
    color: COLORS.white,
    fontSize: SIZES.medium,
    fontWeight: '700',
  },
  featureDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: SIZES.small,
    marginTop: 1,
  },

  contactBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 20,
    marginTop: 20,
  },
  contactTitle: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: SIZES.medium,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  contactText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: SIZES.small,
    marginLeft: 8,
  },

  chatPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  chatWindow: {
    width: '100%',
    maxWidth: 560,
    height: '100%',
    maxHeight: 820,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.large,
  },
});
