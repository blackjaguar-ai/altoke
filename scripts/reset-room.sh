#!/usr/bin/env bash
# Reabre una sala para seguir probando. Uso: npm run room:reset -- bici-monark
set -euo pipefail
ROOM="${1:-bici-monark}"
# Escapa comillas simples por si el id llegara a tener una (no debería, pero
# es gratis prevenirlo).
ESCAPED=$(printf '%s' "$ROOM" | sed "s/'/''/g")

docker compose exec -T db psql -U altoke -d altoke -c "
update rooms set status='open', highest_bid=0, highest_handle=null,
  counter_count=0, winner_handle=null, final_price=null
  where id='$ESCAPED';
delete from bids where room_id='$ESCAPED';
delete from agent_msgs where room_id='$ESCAPED';
"

echo "Sala '$ROOM' reabierta."