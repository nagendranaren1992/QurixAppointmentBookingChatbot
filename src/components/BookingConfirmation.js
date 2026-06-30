import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, SHADOWS } from '../constants/theme';

// Shown when the appointment is successfully booked.
const BookingConfirmation = ({ appointment, summary, onNewBooking }) => (
  <View style={styles.card}>
    <View style={styles.successBadge}>
      <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
    </View>
    <Text style={styles.title}>Appointment Confirmed!</Text>
    <Text style={styles.subtitle}>
      Your booking has been successfully placed.
    </Text>

    <View style={styles.divider} />

    <View style={styles.row}>
      <Text style={styles.label}>Booking ID</Text>
      <Text style={styles.value}>{appointment.appointmentId}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Doctor</Text>
      <Text style={styles.value}>{summary.doctorName}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Department</Text>
      <Text style={styles.value}>{summary.departmentName}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Date & Time</Text>
      <Text style={styles.value}>{summary.date} · {summary.time}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Procedure</Text>
      <Text style={styles.value}>{summary.procedureName}</Text>
    </View>
    <View style={styles.row}>
      <Text style={styles.label}>Patient</Text>
      <Text style={styles.value}>{summary.patientName}</Text>
    </View>

    <TouchableOpacity style={styles.btn} onPress={onNewBooking}>
      <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
      <Text style={styles.btnText}>Book Another Appointment</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    margin: 12,
    borderRadius: SIZES.radius,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.medium,
  },
  successBadge: { marginBottom: 8 },
  title: {
    fontSize: SIZES.xlarge,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  subtitle: {
    fontSize: SIZES.medium,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    alignSelf: 'stretch',
    marginVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 6,
  },
  label: { color: COLORS.textSecondary, fontSize: SIZES.medium },
  value: {
    color: COLORS.textPrimary,
    fontSize: SIZES.medium,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  btn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: SIZES.radiusLarge,
    marginTop: 20,
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: SIZES.medium,
    marginLeft: 8,
  },
});

export default BookingConfirmation;
