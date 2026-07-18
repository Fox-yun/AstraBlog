import { dbQuery } from "./query";
import { withTransaction } from "./transaction";

export { dbQuery, withTransaction };

// Retain default db export mapping to query client for backward compatibility
export const db = dbQuery;
