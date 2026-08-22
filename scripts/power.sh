#!/bin/bash

set -e

ACTION="$1"

if [[ "$ACTION" != "on" && "$ACTION" != "off" ]]; then
    echo "Usage: $0 {on|off}" >&2
    exit 2
fi

# Trouver le premier écran DDC détecté
DISPLAY=$(ddcutil detect 2>/dev/null |
          awk '/Display [0-9]+$/ {found=1; next} found && /I2C bus:/ {
              sub(/.*\/dev\/i2c-/, "");
              print;
              exit
          }')

if [[ -z "$DISPLAY" ]]; then
    echo "Aucun écran DDC détecté" >&2
    exit 1
fi

# Lire les capacités D6 de cet écran
CAPS=$(ddcutil capabilities --bus="$DISPLAY" 2>/dev/null)

if ! grep -q 'Feature: D6 (Power mode)' <<< "$CAPS"; then
    echo "L'écran ne supporte pas D6" >&2
    exit 1
fi

if [[ "$ACTION" == "off" ]]; then
    # Cherche la valeur explicitement décrite comme "turn off display"
    VALUE=$(grep -B1 'turn off display' <<< "$CAPS" |
            grep -oE '^[[:space:]]*[0-9A-Fa-f]{2}:' |
            tail -1 |
            tr -d '[:space:]:')

    [[ -n "$VALUE" ]] || {
        echo "Impossible de trouver la commande OFF D6" >&2
        exit 1
    }
else
    # La valeur 01 est la valeur standard DDC/CI "On"
    VALUE="01"
fi

ddcutil setvcp D6 "$VALUE" --bus="$DISPLAY"