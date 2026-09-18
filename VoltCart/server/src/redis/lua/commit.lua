-- Convert an ACTIVE reservation into a sale (payment succeeded).
-- Stock was already decremented at reserve time, so here we only move the
-- units from "reserved" to "sold" and emit the COMMIT event for MongoDB.
-- ARGV[1] prefix, ARGV[2] saleId, ARGV[3] reservationId, ARGV[4] now(ms),
-- ARGV[5] orderId, ARGV[6] expiry zset key, ARGV[7] stream key

local prefix    = ARGV[1]
local saleId    = ARGV[2]
local resvId    = ARGV[3]
local now       = tonumber(ARGV[4])
local orderId   = ARGV[5]
local zsetKey   = ARGV[6]
local streamKey = ARGV[7]

local resvKey = prefix .. ':resv:' .. resvId
local member  = saleId .. '|' .. resvId

local data = redis.call('HMGET', resvKey, 'status', 'items', 'userId', 'expiresAt')
if not data[1] then
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_FOUND' })
end
if data[1] == 'COMMITTED' then
  -- idempotent: paying twice for the same reservation is a no-op
  return cjson.encode({ ok = true, code = 'ALREADY_COMMITTED' })
end
if data[1] ~= 'ACTIVE' then
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_ACTIVE', status = data[1] })
end
if now > tonumber(data[4]) then
  return cjson.encode({ ok = false, code = 'RESERVATION_EXPIRED' })
end

local items  = cjson.decode(data[2])
local userId = data[3]

for i = 1, #items do
  local it = items[i]
  redis.call('DECRBY', prefix .. ':reserved:' .. it.productId, tonumber(it.quantity))
  redis.call('INCRBY', prefix .. ':sold:' .. it.productId, tonumber(it.quantity))
end

redis.call('HSET', resvKey, 'status', 'COMMITTED',
  'committedAt', string.format('%d', now), 'orderId', orderId)
redis.call('PEXPIRE', resvKey, 3600000)
redis.call('ZREM', zsetKey, member)

redis.call('XADD', streamKey, '*',
  'type', 'COMMIT',
  'saleId', saleId,
  'reservationId', resvId,
  'userId', userId,
  'orderId', orderId,
  'items', data[2],
  'ts', string.format('%d', now))

return cjson.encode({ ok = true, items = data[2] })
