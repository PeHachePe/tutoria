/** A text without accents nor capitals, so «alvaro» finds «Álvaro» and «funcion», «Función». */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
