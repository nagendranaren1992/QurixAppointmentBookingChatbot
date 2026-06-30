// =================================================================
// SessionInstance / Slot models
//
// Mirrors the raw response from `POST /sessioninstances`:
// {
//   doctId, doctName, doctDepartmentId, doctDepartmentName, locUuid,
//   locName, displayName, doctProfilePicture, locId,
//   sessionInstances: [
//     {
//       sessionInstanceId, sessionId, sessionDate ("YYYY-MM-DD HH:mm:ss"),
//       sessionFromTime, sessionToTime, duration, active, ...,
//       listOfTimes: [
//         { slotId, timeSlot ("HH:mm:ss"), sessionId, slotType, booked, channelType }
//       ]
//     }
//   ]
// }
//
// `mapDoctorAvailability(raw)` returns an app-facing object that includes
// a flattened, ready-to-render `availableSlots` array (only non-booked).
// =================================================================

// ---------- raw shape typedefs (documentation only) ----------

/**
 * @typedef {Object} RawSlot
 * @property {number}      slotId
 * @property {string}      timeSlot       "HH:mm:ss"
 * @property {number}      sessionId
 * @property {string|null} channelType
 * @property {number}      slotType
 * @property {boolean}     booked
 */

/**
 * @typedef {Object} RawSessionInstance
 * @property {number}    sessionInstanceId
 * @property {number}    version
 * @property {string}    sessionDate      "YYYY-MM-DD HH:mm:ss"
 * @property {string}    sessionFromTime  "YYYY-MM-DD HH:mm:ss"
 * @property {string}    sessionToTime    "YYYY-MM-DD HH:mm:ss"
 * @property {number}    duration
 * @property {boolean}   active
 * @property {number}    sessionInstanceStatusId
 * @property {number}    sessionId
 * @property {RawSlot[]} listOfTimes
 */

/**
 * @typedef {Object} RawDoctorAvailability
 * @property {string}               doctId
 * @property {string}               locUuid
 * @property {string}               locName
 * @property {string}               doctName
 * @property {number}               doctDepartmentId
 * @property {string}               doctDepartmentName
 * @property {string|null}          doctProfilePicture
 * @property {string}               displayName
 * @property {RawSessionInstance[]} sessionInstances
 * @property {number}               locId
 */

// ---------- app-facing typedefs ----------

/**
 * @typedef {Object} Slot
 * @property {number}      slotId
 * @property {string}      timeSlot           raw "HH:mm:ss"
 * @property {string}      startTime          formatted "9:15 AM"
 * @property {string}      sessionDate        raw "YYYY-MM-DD"
 * @property {string}      date               formatted "30/06/2026"
 * @property {number}      sessionId
 * @property {number}      sessionInstanceId
 * @property {number}      slotType
 * @property {string|null} channelType
 * @property {boolean}     booked
 * @property {boolean}     available          convenience flag = !booked
 */

/**
 * @typedef {Object} SessionInstance
 * @property {number}  sessionInstanceId
 * @property {number}  sessionId
 * @property {string}  sessionDate         raw "YYYY-MM-DD"
 * @property {string}  sessionFromTime     raw "HH:mm:ss"
 * @property {string}  sessionToTime       raw "HH:mm:ss"
 * @property {string}  displayDate         "30/06/2026"
 * @property {string}  displayFromTime     "9:00 AM"
 * @property {string}  displayToTime       "12:00 PM"
 * @property {number}  duration
 * @property {boolean} active
 * @property {Slot[]}  slots
 */

/**
 * @typedef {Object} DoctorAvailability
 * @property {string}            doctorId
 * @property {string}            doctorName
 * @property {string}            displayName
 * @property {string|null}       doctorProfilePicture
 * @property {number|null}       departmentId
 * @property {string}            departmentName
 * @property {string|null}       locationId
 * @property {string}            locationName
 * @property {SessionInstance[]} sessionInstances
 * @property {Slot[]}            availableSlots   flat list of non-booked slots
 */

// ---------- formatting helpers ----------

// "2026-06-30 09:00:00" → { date: "2026-06-30", time: "09:00:00" }
const splitDateTime = (s) => {
  if (!s || typeof s !== 'string') return { date: '', time: '' };
  const [date = '', time = ''] = s.split(' ');
  return { date, time };
};

/**
 * "HH:mm:ss" or "HH:mm" → "h:mm AM/PM"
 */
export const formatTimeSlot = (hhmmss) => {
  if (!hhmmss || typeof hhmmss !== 'string') return '';
  const [hStr, mStr = '00'] = hhmmss.split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return hhmmss;
  const minute = (mStr || '00').slice(0, 2).padStart(2, '0');
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minute} ${meridiem}`;
};

/**
 * "YYYY-MM-DD" → "DD/MM/YYYY"
 */
export const formatDisplayDate = (ymd) => {
  if (!ymd || typeof ymd !== 'string') return '';
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
};

// ---------- mappers ----------

/**
 * @param {RawSlot} raw
 * @param {{ sessionInstanceId?: number, sessionId?: number, sessionDate?: string }} parent
 * @returns {Slot}
 */
export const mapSlot = (raw = {}, parent = {}) => {
  const timeSlot = raw.timeSlot ?? '';
  const sessionDate = parent.sessionDate ?? '';
  return {
    slotId: raw.slotId,
    timeSlot,
    startTime: formatTimeSlot(timeSlot),
    sessionDate,
    date: formatDisplayDate(sessionDate),
    // Prefer the slot's own sessionId; fall back to the parent's.
    sessionId: raw.sessionId ?? parent.sessionId ?? parent.sessionInstanceId ?? null,
    sessionInstanceId: parent.sessionInstanceId ?? null,
    slotType: raw.slotType ?? null,
    channelType: raw.channelType ?? null,
    booked: !!raw.booked,
    available: !raw.booked,
  };
};

/**
 * @param {RawSessionInstance} raw
 * @returns {SessionInstance}
 */
export const mapSessionInstance = (raw = {}) => {
  const sessionDate = splitDateTime(raw.sessionDate).date;
  const fromTime = splitDateTime(raw.sessionFromTime).time;
  const toTime = splitDateTime(raw.sessionToTime).time;
  const parent = {
    sessionInstanceId: raw.sessionInstanceId,
    sessionId: raw.sessionId,
    sessionDate,
  };
  return {
    sessionInstanceId: raw.sessionInstanceId,
    sessionId: raw.sessionId ?? 0,
    sessionDate,
    sessionFromTime: fromTime,
    sessionToTime: toTime,
    displayDate: formatDisplayDate(sessionDate),
    displayFromTime: formatTimeSlot(fromTime),
    displayToTime: formatTimeSlot(toTime),
    duration: raw.duration ?? 0,
    active: !!raw.active,
    slots: Array.isArray(raw.listOfTimes)
      ? raw.listOfTimes.map((t) => mapSlot(t, parent))
      : [],
  };
};

// Unwraps common API envelopes (some endpoints wrap payloads in
// { data: ... } or { result: ... }).
const unwrap = (raw) => raw?.data ?? raw?.result ?? raw;

/**
 * Top-level mapper. Returns a `DoctorAvailability` object that includes a
 * flattened `availableSlots` array — ready for the chatbot's slot picker.
 *
 * Accepts either a single doctor-availability object OR an array of them
 * (some backends return one entry per requested date/doctor).
 *
 * @param {RawDoctorAvailability|RawDoctorAvailability[]} input
 * @returns {DoctorAvailability}
 */
export const mapDoctorAvailability = (input) => {
  const raw = unwrap(input);

  // Normalize to an array of doctor-availability objects, then merge.
  const entries = Array.isArray(raw) ? raw : [raw ?? {}];

  // Collect every sessionInstance across all entries.
  const allSessionInstancesRaw = entries.flatMap((e) =>
    Array.isArray(e?.sessionInstances) ? e.sessionInstances : []
  );

  const sessionInstances = allSessionInstancesRaw.map(mapSessionInstance);

  const availableSlots = sessionInstances
    .flatMap((si) => si.slots)
    .filter((s) => s.available);

  // Use the first non-empty entry for doctor/location metadata.
  const meta = entries.find((e) => e && (e.doctId || e.doctName)) || {};

  return {
    doctorId: meta.doctId ?? null,
    doctorName: meta.doctName ?? '',
    displayName: meta.displayName ?? '',
    doctorProfilePicture: meta.doctProfilePicture ?? null,
    departmentId: meta.doctDepartmentId ?? null,
    departmentName: meta.doctDepartmentName ?? '',
    locationId: meta.locUuid ?? null,
    locationName: meta.locName ?? '',
    sessionInstances,
    availableSlots,
  };
};
