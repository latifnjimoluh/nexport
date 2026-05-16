; Hooks NSIS personnalises pour l'installeur NexPort.
; Doc : https://v2.tauri.app/distribute/windows-installer/#using-installer-hooks
;
; NSIS_HOOK_PREINSTALL : execute juste avant la copie des fichiers,
; donc apres que l'utilisateur a clique sur "Installer". Affiche un
; message d'information bilingue selon la langue choisie au demarrage.

!include "LogicLib.nsh"

!macro NSIS_HOOK_PREINSTALL
  ${If} $LANGUAGE == ${LANG_FRENCH}
    MessageBox MB_ICONINFORMATION|MB_OK \
"NexPort va etre installe sur votre PC.$\r$\n\
$\r$\n\
A QUOI CA SERT$\r$\n\
Surveiller les ports reseau ouverts (TCP/UDP) et tuer en un clic le processus qui occupe un port donne.$\r$\n\
$\r$\n\
OU CA S'INSTALLE$\r$\n\
Dans votre profil utilisateur (%LOCALAPPDATA%\Programs\NexPort). Aucun droit administrateur requis.$\r$\n\
$\r$\n\
DONNEES MOBILES$\r$\n\
Si Microsoft WebView2 n'est pas deja present sur ce PC, il sera telecharge automatiquement (~150 Mo). Si vous etes en connexion mobile limitee, branchez-vous en Wi-Fi avant de continuer."
  ${Else}
    MessageBox MB_ICONINFORMATION|MB_OK \
"NexPort is about to be installed on your PC.$\r$\n\
$\r$\n\
WHAT IT DOES$\r$\n\
Watches the open network ports (TCP/UDP) and lets you kill the process holding a port in a single click.$\r$\n\
$\r$\n\
WHERE IT INSTALLS$\r$\n\
In your user profile (%LOCALAPPDATA%\Programs\NexPort). No admin rights required.$\r$\n\
$\r$\n\
DATA USAGE$\r$\n\
If Microsoft WebView2 is not already on this PC, it will be downloaded automatically (~150 MB). If you are on a metered mobile connection, switch to Wi-Fi before continuing."
  ${EndIf}
!macroend
