-- Atomically reserve flash-sale units for one user.
-- ARGV[1] sale namespace prefix, e.g. fs:{sale:<id>}
-- ARGV[2] saleId
-- ARGV[3] reservationId
-- ARGV[4] userId
-- ARGV[5] ttl seconds
-- ARGV[6] now (ms epoch)
-- ARGV[7] items json: [{ "productId": "...", "quantity": 2 }]
-- ARGV[8] expiry zset key
-- ARGV[9] stream key
-- returns json string

local prefix   = ARGV[1]
local saleId   = ARGV[2]
local resvId   = ARGV[3]
local userId   = ARGV[4]
local ttl      = tonumber(ARGV[5])
local now      = tonumber(ARGV[6])
local itemsRaw = ARGV[7]
local zsetKey  = ARGV[8]
local streamKey= ARGV[9]

local items = cjson.decode(itemsRaw)
if #items == 0 then
  return cjson.encode({ ok = false, code = 'EMPTY_RESERVATION' })
end

-- The sale window itself is the gate (not a cached status string), so a
-- reservation can never slip in before the start or after the end.
local stateKey = prefix .. ':state'
local window = redis.call('HMGET', stateKey, 'startAt', 'endAt')
local startAt = tonumber(window[1] or '0')
local endAt   = tonumber(window[2] or '0')

if startAt == 0 or endAt == 0 or now < startAt then
  return cjson.encode({ ok = false, code = 'SALE_NOT_LIVE' })
end
if now >= endAt then
  return cjson.encode({ ok = false, code = 'SALE_ENDED' })
end

local resvKey = prefix .. ':resv:' .. resvId
if redis.call('EXISTS', resvKey) == 1 then
  return cjson.encode({ ok = false, code = 'RESERVATION_EXISTS' })
end

-- Pass 1: validate everything first so the reservation is all-or-nothing.
for i = 1, #items do
  local it  = items[i]
  local pid = it.productId
  local qty = tonumber(it.quantity)

  if not qty or qty < 1 then
    return cjson.encode({ ok = false, code = 'INVALID_QUANTITY', productId = pid })
  end

  local stockRaw = redis.call('GET', prefix .. ':stock:' .. pid)
  if not stockRaw then
    return cjson.encode({ ok = false, code = 'NOT_IN_SALE', productId = pid })
  end

  local stock = tonumber(stockRaw)
  if stock < qty then
    return cjson.encode({ ok = false, code = 'INSUFFICIENT_STOCK', productId = pid, available = stock })
  end

  local maxPerUser = tonumber(redis.call('HGET', prefix .. ':meta:' .. pid, 'maxPerUser') or '0')
  if maxPerUser > 0 then
    local already = tonumber(redis.call('GET', prefix .. ':uq:' .. userId .. ':' .. pid) or '0')
    if already + qty > maxPerUser then
      return cjson.encode({
        ok = false, code = 'USER_LIMIT_EXCEEDED',
        productId = pid, maxPerUser = maxPerUser, alreadyTaken = already
      })
    end
  end
end

-- Pass 2: mutate. Lua runs single-threaded inside Redis, so pass 1 + pass 2
-- together are one atomic step: no other request can interleave.
for i = 1, #items do
  local it  = items[i]
  local pid = it.productId
  local qty = tonumber(it.quantity)
  redis.call('DECRBY', prefix .. ':stock:' .. pid, qty)
  redis.call('INCRBY', prefix .. ':reserved:' .. pid, qty)
  redis.call('INCRBY', prefix .. ':uq:' .. userId .. ':' .. pid, qty)
end

local expiresAt = now + (ttl * 1000)

redis.call('HSET', resvKey,
  'saleId', saleId,
  'userId', userId,
  'items', itemsRaw,
  'status', 'ACTIVE',
  'createdAt', string.format('%d', now),
  'expiresAt', string.format('%d', expiresAt))
-- Keep the hash a bit longer than the TTL so the UI can still read "expired".
redis.call('PEXPIRE', resvKey, (ttl * 1000) + 600000)

redis.call('ZADD', zsetKey, expiresAt, saleId .. '|' .. resvId)

redis.call('XADD', streamKey, '*',
  'type', 'RESERVE',
  'saleId', saleId,
  'reservationId', resvId,
  'userId', userId,
  'items', itemsRaw,
  'ts', string.format('%d', now))

return cjson.encode({ ok = true, expiresAt = string.format('%d', expiresAt) })
