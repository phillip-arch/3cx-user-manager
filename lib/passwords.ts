// lib/passwords.ts

// DEV ONLY – bez pravog hashiranja, samo za lokalni razvoj.

export function hashPassword(plain: string): string {
  // Možeš da koristiš oba formata.
  // Kad kreiramo nalog iz koda, koristićemo "plain:" + plain
  return `plain:${plain}`;
}

export function verifyPassword(plain: string, hash: string): boolean {
  if (!hash) return false;

  // podrži oba formata: "plain:lozinka" i samo "lozinka"
  if (hash.startsWith("plain:")) {
    return hash === `plain:${plain}`;
  }

  return hash === plain;
}
