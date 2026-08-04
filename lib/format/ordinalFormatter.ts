export class OrdinalFormatter {
  /** "1st", "2nd", "3rd", "4th"... — used for crew leaderboard rank display. */
  static format(n: number): string {
    const rem10 = n % 10;
    const rem100 = n % 100;
    if (rem10 === 1 && rem100 !== 11) return `${n}st`;
    if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
    if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
    return `${n}th`;
  }
}
