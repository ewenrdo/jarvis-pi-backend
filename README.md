# Jarvis Pi Backend


## Configuration

Installez les dépendances systèmes suivantes :
```bash
sudo apt install wmctrl
```

Sur le Raspberry, choisissez un environnement de bureau compatible avec `wmctrl` (comme X11 - XORG). Si vous utilisez Wayland, la commande `wmctrl` ne fonctionnera pas.

## Ports USB et réseau

Par défaut, le serveur tourne sous **5788** _(sauf si vous définissez la variable d'environnement `PORT` pour un autre port)_

Assurez-vous que l'interface web tourne sous le port **3000** et Kodi sous le port **8080**. Si vous avez modifié ces ports, vous devrez également modifier le code du serveur pour qu'il corresponde à vos paramètres.

**ATTENTION :** Assurez-vous que le port USB où est branché la télécommande soit autorisé à rester ouvert même lorsque l'écran est éteint. Sinon, la télécommande ne fonctionnera pas pour rallumer l'écran.

## Gestion des autorisations

**AUTORISATION :** L'utilisateur courant doit avoir les droits pour récupérer les inputs de la télécommande. Pour cela, ajoutez l'utilisateur courant au groupe `input` :
```bash
sudo usermod -aG input $USER
```

## Lancement du serveur par défaut

Si vous utilisez le Raspberry Pi, vous pouvez lancer le serveur automatiquement comme service système :
```bash
sudo cp jarvis-pi-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable jarvis-pi-backend.service
sudo systemctl start jarvis-pi-backend.service
```

## Réflexion

Si la télécommande ne fonctionne pas, essayez dans le code de remplacer le canal `alphanumeric` par `key` dans le `server.js`. Cela peut résoudre certains problèmes de compatibilité avec certaines télécommandes.