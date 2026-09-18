/**
 * All flash-sale keys for one sale share the hash tag `{sale:<id>}` so that a
 * multi-key Lua script always touches a single slot (safe on Redis Cluster).
 */
export const saleNs = (saleId) => `fs:{sale:${saleId}}`;

export const stockKey = (saleId, productId) => `${saleNs(saleId)}:stock:${productId}`;
export const reservedKey = (saleId, productId) => `${saleNs(saleId)}:reserved:${productId}`;
export const soldKey = (saleId, productId) => `${saleNs(saleId)}:sold:${productId}`;
export const metaKey = (saleId, productId) => `${saleNs(saleId)}:meta:${productId}`;
export const stateKey = (saleId) => `${saleNs(saleId)}:state`;
export const reservationKey = (saleId, reservationId) => `${saleNs(saleId)}:resv:${reservationId}`;
export const userQtyKey = (saleId, userId, productId) => `${saleNs(saleId)}:uq:${userId}:${productId}`;

export const EXPIRY_ZSET = 'fs:resv:expiry';
export const STREAM_KEY = 'fs:inventory:events';
export const STREAM_GROUP = 'mongo-sync';
export const ACTIVE_SALE_KEY = 'fs:active-sale';
