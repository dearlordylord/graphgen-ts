export const fromEntries = <K extends string | number, V>(
  es: [K, V][] | (readonly [K, V])[]
): { [k in K]: V } => Object.fromEntries(es) as { [k in K]: V };

// maps the keys of a Map in a generic way
