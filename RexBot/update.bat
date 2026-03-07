@echo off
echo Updating RexBot...
cd /d "C:\Users\Administrator\Desktop\Blood&Bone\RexBot" || goto :fail

echo Pulling latest code...
git pull || goto :fail

echo Installing dependencies...
call npm install || goto :fail

echo Restarting bot...
pm2 restart RexBot || goto :fail

echo Saving PM2 state...
pm2 save || goto :fail

echo Update complete!
pause
exit /b 0

:fail
echo Update failed.
pause
exit /b 1