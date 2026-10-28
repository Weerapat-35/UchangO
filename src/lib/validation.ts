export const MAX_PHONE_LENGTH = 10;
export const MAX_HOUSE_NUMBER_LENGTH = 20;
export const MAX_NAME_LENGTH = 100;
export const MAX_ADDRESS_TEXT_LENGTH = 100;
export const MAX_POSTAL_CODE_LENGTH = 5;

export function digitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, "");
  return typeof maxLength === "number" ? digits.slice(0, maxLength) : digits;
}

export function normalizeThaiPhone(value: string) {
  return digitsOnly(value, MAX_PHONE_LENGTH);
}

export function isValidThaiPhone(value: string) {
  return /^0\d{9}$/.test(value);
}

export function isValidPostalCode(value: string) {
  return /^\d{5}$/.test(value);
}

export function isValidNonNegativeNumber(value: number, integer = false) {
  return Number.isFinite(value) && value >= 0 && (!integer || Number.isInteger(value));
}

export function isValidPositiveInteger(value: number) {
  return Number.isInteger(value) && value >= 1;
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * ใช้กับ onKeyDown ของ <input type="number"> — เบราว์เซอร์ยอมให้พิมพ์ e, +, - ได้
 * จึงกันไว้ไม่ให้ใส่ค่าติดลบหรือเลขยกกำลัง (allowDecimal=false กันจุดทศนิยมด้วย)
 */
export function blockNonNumericKeys(
  event: { key: string; preventDefault: () => void },
  allowDecimal = false,
) {
  if (["e", "E", "+", "-"].includes(event.key) || (!allowDecimal && event.key === ".")) {
    event.preventDefault();
  }
}

export function blockNonDecimalKeys(event: { key: string; preventDefault: () => void }) {
  blockNonNumericKeys(event, true);
}
