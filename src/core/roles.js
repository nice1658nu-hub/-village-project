export const ROLE = Object.freeze({
  TAO: 'tao',
  VILLAGE_ADMIN: 'village_admin',
  CITIZEN: 'user',
});

export const isTaoRole = role => ['tao', 'admin'].includes(role);
export const isVillageAdminRole = role => ['village_admin', 'staff'].includes(role);
export const isCitizenRole = role => role === ROLE.CITIZEN;
