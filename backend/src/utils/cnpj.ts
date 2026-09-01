export const onlyDigits = (value: string) => value.replace(/\D/g, '');

export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const calculateDigit = (length: number) => {
    const numbers = cnpj.slice(0, length).split('').map(Number);
    let factor = length - 7;
    const sum = numbers.reduce((total, number) => {
      const result = total + number * factor;
      factor = factor === 2 ? 9 : factor - 1;
      return result;
    }, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13]);
}
