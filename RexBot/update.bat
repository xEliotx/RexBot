@echo off
echo Updating RexBot...
cd /d "%~dp0"

git pull
call npm install

pm2 restart RexBot
pm2 save

echo Update complete!
pause