-- Undo a COMMITTED reservation (customer cancelled the order before dispatch).
-- Units move from "sold" back into the available pool and the per-user cap is
-- refunded so the customer can buy the deal again.
-- ARGV[1] prefix, ARGV[2] saleId, ARGV[3] reservationId, ARGV[4] now(ms),
-- ARGV[5] reason, ARGV[6] stream key

local prefix    = ARGV[1]
local saleId    = ARGV[2]
local resvId    = ARGV[3]
local now       = tonumber(ARGV[4])
local reason    = ARGV[5]
local streamKey = ARGV[6]

local resvKey = prefix .. ':resv:' .. resvId

local data = redis.call('HMGET', resvKey, 'status', 'items', 'userId')
if not data[1] then
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_FOUND' })
end
if data[1] == 'CANCELLED' then
  -- idempotent: cancelling twice must not hand out free stock
  return cjson.encode({ ok = true, code = 'ALREADY_CANCELLED' })
end
if data[1] ~= 'COMMITTED' then
  return cjson.encode({ ok = false, code = 'RESERVATION_NOT_COMMITTED', status = data[1] })
end

local items  = cjson.decode(data[2])
local userId = data[3]

for i = 1, #items do
  local it  = items[i]
  local pid = it.productId
  local qty = tonumber(it.quantity)
  redis.call('INCRBY', prefix .. ':stock:' .. pid, qty)
  redis.call('DECRBY', prefix .. ':sold:' .. pid, qty)
  local left = redis.call('DECRBY', prefix .. ':uq:' .. userId .. ':' .. pid, qty)
  if left <= 0 then redis.call('DEL', prefix .. ':uq:' .. userId .. ':' .. pid) end
end

redis.call('HSET', resvKey, 'status', 'CANCELLED',
  'cancelledAt', string.format('%d', now), 'cancelReason', reason)
redis.call('PEXPIRE', resvKey, 3600000)

redis.call('XADD', streamKey, '*',
  'type', 'RESTOCK',
  'saleId', saleId,
  'reservationId', resvId,
  'userId', userId,
  'items', data[2],
  'reason', reason,
  'ts', string.format('%d', now))

return cjson.encode({ ok = true, items = data[2] })
