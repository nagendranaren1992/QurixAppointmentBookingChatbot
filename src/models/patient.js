// =================================================================
// Patient model
//
// Mirrors the raw response from `GET /patients?mobileNo=...&orgId=...&isActive=...&locids=...`:
// {
//   title, uhid, mobile, firstName, lastName, uuid, gender, dob,
//   previousEpisodeId, previousEpiosdeStatus, previousPractitioner,
//   previousEpisodeType, previousAdmittingDoctor, followupEligible,
//   lastVisitedDate, noofDaysAvailable, noofVisitsAvailable,
//   years, months, days, masterIdentifierId, identifiers,
//   paymentStatus, previousPractitionerDeptId
// }
//
// The endpoint returns a single patient object when a match exists.
// `mapPatientLookupResponse` adapts the response (single object OR
// empty / null) into the `{ exists, patients[] }` shape the chatbot
// already consumes downstream.
// =================================================================

// ---------- raw shape typedef (documentation only) ----------

/**
 * @typedef {Object} RawPatient
 * @property {string|null} title
 * @property {string|null} uhid
 * @property {string|null} mobile
 * @property {string|null} firstName
 * @property {string|null} lastName
 * @property {string|null} uuid
 * @property {string|null} gender
 * @property {string|null} dob                     "YYYY-MM-DD"
 * @property {number|null} previousEpisodeId
 * @property {string|null} previousEpiosdeStatus   (sic — API typo)
 * @property {string|null} previousPractitioner
 * @property {string|null} previousEpisodeType
 * @property {string|null} previousAdmittingDoctor
 * @property {boolean}     followupEligible
 * @property {string|null} lastVisitedDate
 * @property {number}      noofDaysAvailable
 * @property {number}      noofVisitsAvailable
 * @property {number}      years
 * @property {number}      months
 * @property {number}      days
 * @property {string|null} masterIdentifierId
 * @property {Array|null}  identifiers
 * @property {string|null} paymentStatus
 * @property {number}      previousPractitionerDeptId
 */

// ---------- app-facing typedefs ----------

/**
 * @typedef {Object} PatientAge
 * @property {number} years
 * @property {number} months
 * @property {number} days
 */

/**
 * @typedef {Object} Patient
 * @property {string|null} patientId         alias of uuid (used for booking)
 * @property {string|null} uuid
 * @property {string|null} uhid
 * @property {string|null} title
 * @property {string}      firstName
 * @property {string}      lastName
 * @property {string}      fullName          "Title FirstName LastName"
 * @property {string|null} mobile
 * @property {string|null} gender
 * @property {string|null} dob
 * @property {PatientAge}  age
 * @property {string|null} masterIdentifierId
 * @property {Array|null}  identifiers
 * @property {boolean}     followupEligible
 * @property {string|null} lastVisitedDate
 * @property {number}      noofDaysAvailable
 * @property {number}      noofVisitsAvailable
 * @property {number|null} previousEpisodeId
 * @property {string|null} previousEpisodeStatus
 * @property {string|null} previousEpisodeType
 * @property {string|null} previousPractitioner
 * @property {string|null} previousAdmittingDoctor
 * @property {number|null} previousPractitionerDeptId
 * @property {string|null} paymentStatus
 */

/**
 * @typedef {Object} PatientLookupResult
 * @property {boolean}    exists
 * @property {Patient[]}  patients
 */

// ---------- helpers ----------

const isMeaningfulPatient = (raw) =>
  !!raw && (raw.uuid || raw.mobile || raw.firstName || raw.uhid);

// ---------- mappers ----------

/**
 * @param {RawPatient} raw
 * @returns {Patient}
 */
export const mapPatient = (raw = {}) => {
  const firstName = raw.firstName ?? '';
  const lastName = raw.lastName ?? '';
  const title = raw.title ?? '';
  const fullName = [title, firstName, lastName]
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .join(' ');

  return {
    patientId: raw.uuid ?? null,
    uuid: raw.uuid ?? null,
    uhid: raw.uhid ?? null,
    title: raw.title ?? null,
    firstName,
    lastName,
    fullName,
    mobile: raw.mobile ?? null,
    gender: raw.gender ?? null,
    dob: raw.dob ?? null,
    age: {
      years: raw.years ?? 0,
      months: raw.months ?? 0,
      days: raw.days ?? 0,
    },
    masterIdentifierId: raw.masterIdentifierId ?? null,
    identifiers: raw.identifiers ?? null,
    followupEligible: !!raw.followupEligible,
    lastVisitedDate: raw.lastVisitedDate ?? null,
    noofDaysAvailable: raw.noofDaysAvailable ?? 0,
    noofVisitsAvailable: raw.noofVisitsAvailable ?? 0,
    previousEpisodeId: raw.previousEpisodeId ?? null,
    // The API spells this `previousEpiosdeStatus` — fall back to either.
    previousEpisodeStatus:
      raw.previousEpisodeStatus ?? raw.previousEpiosdeStatus ?? null,
    previousEpisodeType: raw.previousEpisodeType ?? null,
    previousPractitioner: raw.previousPractitioner ?? null,
    previousAdmittingDoctor: raw.previousAdmittingDoctor ?? null,
    previousPractitionerDeptId: raw.previousPractitionerDeptId ?? null,
    paymentStatus: raw.paymentStatus ?? null,
  };
};

/**
 * Normalize the raw lookup response (single patient object, an array, or
 * empty / null) into the chatbot's `{ exists, patients[] }` envelope.
 *
 * @param {RawPatient | RawPatient[] | null | undefined} raw
 * @returns {PatientLookupResult}
 */
export const mapPatientLookupResponse = (raw) => {
  if (raw == null || raw === '') {
    return { exists: false, patients: [] };
  }

  if (Array.isArray(raw)) {
    const patients = raw.filter(isMeaningfulPatient).map(mapPatient);
    return { exists: patients.length > 0, patients };
  }

  if (typeof raw === 'object') {
    if (!isMeaningfulPatient(raw)) {
      return { exists: false, patients: [] };
    }
    return { exists: true, patients: [mapPatient(raw)] };
  }

  return { exists: false, patients: [] };
};
