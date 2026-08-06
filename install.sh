#!/bin/bash

# Arrêter le script en cas d'erreur
set -e

echo "=== Début de l'installation de Jarvis Pi Backend ==="

# 1. Mise à jour et installation des dépendances système
echo "--- Installation des dépendances système (Kodi, Chromium, wmctrl, brightnessctl) ---"
sudo apt update
sudo apt install -y wmctrl brightnessctl chromium-browser kodi

# 2. Configuration des groupes utilisateurs
echo "--- Configuration des permissions utilisateurs ---"
sudo usermod -aG video $USER
sudo usermod -aG input $USER

# 3. Téléchargement ou clonage du front-end
FRONT_DIR="$HOME/jarvis-pi"
FRONT_REPO_URL="https://github.com/ewenrdo/jarvis-pi"

if [ -d "$FRONT_DIR" ]; then
    echo "--- Le dossier du front-end ($FRONT_DIR) existe déjà. Mise à jour (git pull)... ---"
    cd "$FRONT_DIR"
    git pull
    cd - > /dev/null
else
    echo "--- Clonage du front-end Jarvis Pi depuis $FRONT_REPO_URL ---"
    git clone "$FRONT_REPO_URL" "$FRONT_DIR"
fi

# Installation des dépendances du front
echo "--- Installation des dépendances npm du front-end ---"
cd "$FRONT_DIR"
npm install
cd - > /dev/null

# 4. Configuration interactive du fichier .env
ENV_FILE=".env"
echo "--- Configuration du fichier .env ---"

if [ -f "$ENV_FILE" ]; then
    echo "Un fichier .env existe déjà."
    read -p "Souhaitez-vous le reconfigurer ? (y/N) : " RECONFIGURE
    RECONFIGURE=${RECONFIGURE:-N}
else
    RECONFIGURE="y"
fi

if [[ "$RECONFIGURE" =~ ^[Yy]$ ]]; then
    read -p "Nom d'utilisateur Kodi [kodi] : " KODI_USER_INPUT
    KODI_USER=${KODI_USER_INPUT:-kodi}

    read -p "Mot de passe Kodi [root] : " KODI_PASSWORD_INPUT
    KODI_PASSWORD=${KODI_PASSWORD_INPUT:-root}

    read -p "Port du serveur backend [5788] : " PORT_INPUT
    PORT=${PORT_INPUT:-5788}

    read -p "Heure de démarrage de l'écran (00-23) [09] : " SCREEN_START_INPUT
    SCREEN_START=${SCREEN_START_INPUT:-09}

    read -p "Heure d'extinction de l'écran (00-23) [21] : " SCREEN_END_INPUT
    SCREEN_END=${SCREEN_END_INPUT:-21}

    cat << EOF > "$ENV_FILE"
KODI_USER=$KODI_USER
KODI_PASSWORD=$KODI_PASSWORD
PORT=$PORT
PATH_TO_FRONT=$HOME/jarvis-pi
SCREEN_START=$SCREEN_START
SCREEN_END=$SCREEN_END
EOF
    echo "Fichier .env généré avec succès !"
else
    echo "Conservation du fichier .env actuel."
fi

# 5. Installation des dépendances npm du backend
echo "--- Installation des dépendances npm du backend ---"
npm install

echo "=== Installation terminée avec succès ! ==="
echo "Vous pouvez lancer votre serveur avec : node server.js"