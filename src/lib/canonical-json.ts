export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  function serialize(current: unknown, inArray = false): string | undefined {
    if (current && typeof current === "object" && "toJSON" in current) {
      const toJSON = (current as { toJSON?: unknown }).toJSON;
      if (typeof toJSON === "function") {
        return serialize(toJSON.call(current), inArray);
      }
    }
    if (current === undefined || typeof current === "function" || typeof current === "symbol") {
      return inArray ? "null" : undefined;
    }
    if (!current || typeof current !== "object") {
      return JSON.stringify(current);
    }
    if (seen.has(current)) throw new TypeError("Cannot canonicalize a cyclic value");
    seen.add(current);
    try {
      if (Array.isArray(current)) {
        return `[${current.map((item) => serialize(item, true) ?? "null").join(",")}]`;
      }
      const record = current as Record<string, unknown>;
      const properties = Object.keys(record)
        .sort()
        .flatMap((key) => {
          const serialized = serialize(record[key]);
          return serialized === undefined ? [] : [`${JSON.stringify(key)}:${serialized}`];
        });
      return `{${properties.join(",")}}`;
    } finally {
      seen.delete(current);
    }
  }

  return serialize(value) ?? "null";
}
