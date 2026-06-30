// =================================================================
// Procedure model
//
// Mirrors the raw response from `POST /listOfDoctorWiseProceduresV2`:
// [
//   {
//     id, procedureName, price, duration, serviceId, serviceCode,
//     active, appointment_open, virtual, followUp,
//     createdOn, createdBy, modifiedOn, modifiedBy,
//     serviceDtos: [ { serviceHeaderId, serviceHeaderName, price } ]
//   },
//   ...
// ]
// =================================================================

// ---------- raw shape typedefs (documentation only) ----------

/**
 * @typedef {Object} RawServiceDto
 * @property {number} serviceHeaderId
 * @property {string} serviceHeaderName
 * @property {number} price
 */

/**
 * @typedef {Object} RawProcedure
 * @property {number}            id
 * @property {string}            procedureName
 * @property {number}            price
 * @property {number}            duration
 * @property {number|null}       serviceId
 * @property {string|null}       serviceCode
 * @property {boolean}           active
 * @property {boolean}           appointment_open
 * @property {boolean}           virtual
 * @property {boolean}           followUp
 * @property {RawServiceDto[]|null} serviceDtos
 */

// ---------- app-facing typedefs ----------

/**
 * @typedef {Object} ServiceDto
 * @property {number} serviceHeaderId
 * @property {string} serviceHeaderName
 * @property {number} price
 */

/**
 * @typedef {Object} Procedure
 * @property {number}       procedureId        alias of `id`
 * @property {number}       id
 * @property {string}       procedureName
 * @property {number}       price
 * @property {number}       fee                alias of `price` (legacy compat)
 * @property {number}       duration
 * @property {number|null}  serviceId
 * @property {string|null}  serviceCode
 * @property {boolean}      active
 * @property {boolean}      appointmentOpen
 * @property {boolean}      virtual
 * @property {boolean}      followUp
 * @property {ServiceDto[]} serviceDtos
 * @property {('virtual'|'free'|'paid')} type   convenience derived flag
 */

// ---------- helpers ----------

const unwrap = (raw) => raw?.data ?? raw?.result ?? raw;

const mapServiceDto = (raw = {}) => ({
  serviceHeaderId: raw.serviceHeaderId,
  serviceHeaderName: raw.serviceHeaderName ?? '',
  price: raw.price ?? 0,
});

const deriveType = (raw) => {
  if (raw?.virtual) return 'virtual';
  if (raw?.followUp || (raw?.price ?? 0) === 0) return 'free';
  return 'paid';
};

// ---------- mappers ----------

/**
 * @param {RawProcedure} raw
 * @returns {Procedure}
 */
export const mapProcedure = (raw = {}) => ({
  procedureId: raw.id ?? null,
  id: raw.id ?? null,
  procedureName: raw.procedureName ?? '',
  price: raw.price ?? 0,
  fee: raw.price ?? 0,
  duration: raw.duration ?? 0,
  serviceId: raw.serviceId ?? null,
  serviceCode: raw.serviceCode ?? null,
  active: !!raw.active,
  appointmentOpen: !!raw.appointment_open,
  virtual: !!raw.virtual,
  followUp: !!raw.followUp,
  serviceDtos: Array.isArray(raw.serviceDtos)
    ? raw.serviceDtos.map(mapServiceDto)
    : [],
  type: deriveType(raw),
});

/**
 * Normalize the raw response. Accepts an array (the documented shape),
 * a single procedure object, or a `{ data | result }` envelope.
 *
 * @param {RawProcedure | RawProcedure[] | null | undefined} input
 * @returns {Procedure[]}
 */
export const mapProceduresResponse = (input) => {
  const raw = unwrap(input);
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(mapProcedure);
  if (typeof raw === 'object') return [mapProcedure(raw)];
  return [];
};

/**
 * Apply the patient-eligibility visibility rule.
 *
 * Procedures with `serviceCode === 'OPREVISIT'` represent the follow-up /
 * revisit option, which is only valid for patients within their follow-up
 * window. We hide them by default and reveal them only when the patient
 * record reports `followupEligible === true`.
 *
 * @param {Procedure[]} procedures
 * @param {{ followupEligible?: boolean }} [opts]
 * @returns {Procedure[]}
 */
export const filterProceduresForPatient = (procedures, { followupEligible = false } = {}) => {
  if (!Array.isArray(procedures)) return [];
  if (followupEligible) return procedures;
  return procedures.filter((p) => p.serviceCode !== 'OPREVISIT');
};
