export class PluralFormatter {
  /** The "-s" suffix a count needs — `` `${n} session${PluralFormatter.suffix(n)}` ``. */
  static suffix(count: number): string {
    return count === 1 ? "" : "s";
  }
}
