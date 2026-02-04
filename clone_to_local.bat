@echo off
REM Clone Syria Pay project to local PC

echo.
echo ========================================
echo   Cloning Syria Pay to Local PC
echo ========================================
echo.

REM Ask user for destination folder
set /p DEST="Enter destination folder (e.g., C:\Users\YourName\Projects\SyriaPay): "

if exist "%DEST%" (
    echo Folder already exists. Continue anyway? (Y/N)
    set /p CONTINUE=
    if /i not "%CONTINUE%"=="Y" exit /b
) else (
    mkdir "%DEST%"
    echo Created folder: %DEST%
)

echo.
echo Copying files...

REM Copy root files
copy z:\package.json "%DEST%\" /Y
copy z:\README.md "%DEST%\" /Y
copy z\.env.example "%DEST%\" /Y
copy z\start.bat "%DEST%\" /Y
copy z\server_simple.js "%DEST%\server.js" /Y

REM Copy web_card_app
mkdir "%DEST%\web_card_app"
copy z:\web_card_app\*.* "%DEST%\web_card_app\" /Y

REM Copy python_card_app
mkdir "%DEST%\python_card_app"
copy z:\python_card_app\*.* "%DEST%\python_card_app\" /Y

echo.
echo ========================================
echo   Clone Complete!
echo ========================================
echo.
echo Location: %DEST%
echo.
echo Next steps:
echo 1. Open folder in VS Code or your editor
echo 2. Run: npm install
echo 3. Create .env file with STRIPE_SECRET_KEY
echo 4. Run: npm start
echo.
pause
