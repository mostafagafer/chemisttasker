@echo off
echo ==========================================
echo      Initializing ChemistTasker Demo
echo ==========================================
echo.
echo Copying files from frontend_web...
echo (This may take a few seconds)
echo.
:: Copy all files, excluding node_modules, .git, dist, demo
:: /XC /XN /XO preserves files we already modified (package.json, main.tsx, etc.)
robocopy ..\frontend_web . /E /XD node_modules .git dist demo /XC /XN /XO /R:0 /W:0

:: Robocopy returns exit code 1 for success (files copied)
if %ERRORLEVEL% LSS 8 ( 
    echo Copy Successful 
) else ( 
    echo Copy Failed with error %ERRORLEVEL% 
)

echo.
echo ==========================================
echo      Setup Partial Complete
echo ==========================================
echo.
echo Installing dependencies...
echo.
call npm install

if %ERRORLEVEL% EQU 0 (
    echo Dependencies installed
) else (
    echo npm install failed with error %ERRORLEVEL%
)

echo.
echo ==========================================
echo      Setup Complete
echo ==========================================
echo.
echo Next Steps:
echo 1. npm run dev
echo.
pause
