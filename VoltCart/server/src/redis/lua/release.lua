-- Release an ACTIVE reservation: units go back into the sale pool.
-- ARGV[1] prefix, ARGV[2] saleId, ARGV[3] reservationId, ARGV[4] now(ms),
-- ARGV[5] reason, ARGV[6] expiry zset key, ARGV[7] stream key

local prefix    = ARGV[1]
local saleId    = ARGV[2]
local resvId    = ARGV[3]
local now       = tonumber(ARGV[4])
local reason    = ARGV[5]
local zsetKey   = ARGV[6]
local streamKey = ARGV[7]

local resvKey = prefix .. ':resv:' .. resvId
local member  = saleId .. '|' .. resvId

local data = redis.call('HMGET', resvKey, 'status', 'items', 'userId')
if not data[1] then
  redis.call('ZREM', zsetKey, member)
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_FOUND' })
end

if data[1] ~= 'ACTIVE' then
  redis.call('ZREM', zsetKey, member)
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_ACTIVE', status = data[1] })
end

local items  = cjson.decode(data[2])
local userId = data[3]

for i = 1, #items do
  local it  = items[i]
  local pid = it.productId
  local qty = tonumber(it.quantity)
  redis.call('INCRBY', prefix .. ':stock:' .. pid, qty)
  redis.call('DECRBY', prefix .. ':reserved:' .. pid, qty)
  local left = redis.call('DECRBY', prefix .. ':uq:' .. userId .. ':' .. pid, qty)
  if left <= 0 then redis.call('DEL', prefix .. ':uq:' .. userId .. ':' .. pid) end
end

redis.call('HSET', resvKey, 'status', 'RELEASED',
  'releasedAt', string.format('%d', now), 'releaseReason', reason)
redis.call('PEXPIRE', resvKey, 600000)
redis.call('ZREM', zsetKey, member)

redis.call('XADD', streamKey, '*',
  'type', 'RELEASE',
  'saleId', saleId,
  'reservationId', resvId,
  'userId', userId,
  'items', data[2],
  'reason', reason,
  'ts', string.format('%d', now))

return cjson.encode({ ok = true, items = data[2] })
