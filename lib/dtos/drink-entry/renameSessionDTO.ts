export class RenameSessionDTO {
  declare id: string;
  /** null (or an empty string, normalized to null) clears the custom name, reverting to the default title. */
  declare name: string | null;
}
