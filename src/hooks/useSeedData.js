/**
 * useSeedData — intentionally a no-op.
 *
 * The app no longer seeds any data on first load. All historical lançamentos
 * (proventos, compras, vendas) come exclusively from user input via the
 * Lançamentos tab. The one-time localStorage reset is handled synchronously
 * inside load() in useLancamentos.js, so the app always starts clean on a
 * fresh install.
 */
export function useSeedData() {
  // No seeding performed.
}
