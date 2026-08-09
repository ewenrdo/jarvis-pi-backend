#!/bin/bash

# Arrêter le script en cas d'erreur
set -e

echo "=== Début de l'installation de Jarvis Pi Backend ==="

# 1. Mise à jour et installation des dépendances système (avec Kodi, Chromium, et InputStream Adaptive)
echo "--- Installation des dépendances système (Kodi, InputStream Adaptive, Chromium, wmctrl, brightnessctl) ---"
sudo apt update
sudo apt install -y wmctrl brightnessctl chromium-browser kodi kodi-inputstream-adaptive wget python3-pip

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

# 4. Préparation du projet Renault statsPi
RENAULT_DIR="$HOME/renault-statsPi"
RENAULT_REPO_URL="https://github.com/ewenrdo/renault-statsPi"

echo "--- Préparation du projet Renault statsPi ---"
if [ -d "$RENAULT_DIR" ]; then
    echo "--- Le dossier Renault statsPi ($RENAULT_DIR) existe déjà. Mise à jour (git pull)... ---"
    cd "$RENAULT_DIR"
    git pull
    cd - > /dev/null
else
    echo "--- Clonage du projet Renault statsPi depuis $RENAULT_REPO_URL ---"
    git clone "$RENAULT_REPO_URL" "$RENAULT_DIR"
fi

echo "--- Installation des dépendances Python du projet Renault statsPi ---"
python3 -m pip install --break-system-packages renault-api python-dotenv aiohttp fastapi uvicorn "aiohttp[speedups]"

# 5. Téléchargement du repository CastagnaIT pour Kodi (pour YouTube notamment)
echo "--- Téléchargement du repository Kodi CastagnaIT ---"
wget https://github.com/CastagnaIT/repository.castagnait/raw/kodi/repository.castagnait-2.0.1.zip -O "$HOME/repository.castagnait.zip"

# 6. Configuration interactive du fichier .env
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

    read -p "Votre clé API IDFM (Île-de-France Mobilités) : " IDFM_API_KEY

    read -p "Adresse e-mail Renault : " RENAULT_USERNAME
    read -p "Mot de passe Renault : " RENAULT_PASSWORD
    read -p "Numéro VIN du véhicule : " VIN_ID
    read -p "ID Kamereon account : " KAMEREON_ACCOUNT_ID

    cat << EOF > "$ENV_FILE"
KODI_USER=$KODI_USER
KODI_PASSWORD=$KODI_PASSWORD
PORT=$PORT
PATH_TO_FRONT=$HOME/jarvis-pi
SCREEN_START=$SCREEN_START
SCREEN_END=$SCREEN_END
RENAULT_STATS_PI_PATH=$RENAULT_DIR
MY_RENAULT_USERNAME=$RENAULT_USERNAME
MY_RENAULT_PASSWORD=$RENAULT_PASSWORD
VIN_ID=$VIN_ID
KAMEREON_ACCOUNT_ID=$KAMEREON_ACCOUNT_ID
IDFM_API_KEY=$IDFM_API_KEY
EOF
    echo "Fichier .env généré avec succès !"
else
    echo "Conservation du fichier .env actuel."
fi

# 7. Configuration du fichier .env dédié au projet Renault statsPi
echo "--- Configuration du fichier .env du projet Renault statsPi ---"
RENAULT_ENV_FILE="$RENAULT_DIR/.env"

if [ -f "$RENAULT_ENV_FILE" ]; then
    echo "Un fichier .env existe déjà dans $RENAULT_DIR."
    read -p "Souhaitez-vous le reconfigurer ? (y/N) : " RENAULT_RECONFIGURE
    RENAULT_RECONFIGURE=${RENAULT_RECONFIGURE:-N}
else
    RENAULT_RECONFIGURE="y"
fi

if [[ "$RENAULT_RECONFIGURE" =~ ^[Yy]$ ]]; then
    cat << EOF > "$RENAULT_ENV_FILE"
MY_RENAULT_USERNAME=$RENAULT_USERNAME
MY_RENAULT_PASSWORD=$RENAULT_PASSWORD
VIN_ID=$VIN_ID
KAMEREON_ACCOUNT_ID=$KAMEREON_ACCOUNT_ID
EOF
    echo "Fichier .env Renault généré avec succès dans $RENAULT_ENV_FILE !"
else
    echo "Conservation du fichier .env Renault actuel."
fi

# 8. Installation des dépendances npm du backend
echo "--- Installation des dépendances npm du backend ---"
npm install

# 9. Configuration optionnelle du service systemd (Démarrage auto + redémarrage sur crash)
echo "------------------------------------------------"
read -p "Souhaitez-vous lancer le serveur automatiquement au démarrage et le relancer en cas de crash (service Systemd) ? (y/N) : " AUTOSTART
AUTOSTART=${AUTOSTART:-N}

if [[ "$AUTOSTART" =~ ^[Yy]$ ]]; then
    BACKEND_DIR="$(pwd)"
    SERVICE_FILE="/etc/systemd/system/jarvis-pi-backend.service"

    echo "--- Création du service Systemd ---"
    sudo bash -c "cat << EOF > $SERVICE_FILE
[Unit]
Description=Jarvis Pi Backend Service
After=network.target graphical.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node $BACKEND_DIR/server.js
Restart=always
RestartSec=10
Environment=DISPLAY=:0
Environment=XAUTHORITY=$HOME/.Xauthority
Environment=RENAULT_STATS_PI_PATH=$RENAULT_DIR
EnvironmentFile=$BACKEND_DIR/.env

[Install]
WantedBy=multi-user.target
EOF"

    echo "--- Activation et démarrage du service ---"
    sudo systemctl daemon-reload
    sudo systemctl enable jarvis-pi-backend.service
    sudo systemctl start jarvis-pi-backend.service
    echo "Service systemd configuré et démarré avec succès !"
else
    echo "Service systemd ignoré."
fi

echo "=== Installation terminée avec succès ! ==="
echo "Le fichier zip du repo Kodi CastagnaIT a été téléchargé dans votre dossier personnel (~/repository.castagnait.zip)."