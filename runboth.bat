@echo off
start wt new-tab --title "front" cmd /k "cd /d %~dp0 && npm run dev" ; new-tab --title "back" cmd /k "cd /d %~dp0 && npm run server"