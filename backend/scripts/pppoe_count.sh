#!/bin/bash
HOST=${1:-45.183.64.1}
COMMUNITY=${2:-Libernet-v2}
IFACE_IDX=$3
if [ -n "$IFACE_IDX" ]; then
  snmpwalk -v2c -c "$COMMUNITY" -t 15 "$HOST" 1.3.6.1.4.1.2011.5.25.40.12.1.2.1.1.$IFACE_IDX 2>/dev/null | wc -l
else
  snmpwalk -v2c -c "$COMMUNITY" -t 15 "$HOST" 1.3.6.1.4.1.2011.5.25.40.12.1.2.1.1 2>/dev/null | wc -l
fi
