export class JsonSerializer {
  static async deserialize<T extends object>(
    request: Request,
    DTOClass: new () => T
  ): Promise<T | null> {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return null;
    }

    const input = new DTOClass();
    for (const key of Object.keys(input) as (keyof T)[]) {
      const value = body[key as string];
      (input as Record<string, unknown>)[key as string] = typeof value === "string" ? value : "";
    }
    return input;
  }
}
