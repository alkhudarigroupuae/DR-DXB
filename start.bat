@echo off
REM Syria Pay Startup Script for Windows

echo.
echo ========================================
echo   Syria Pay - Card Generator & Stripe
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install from: https://nodejs.org/
    echo Make sure to add Node.js to PATH
    pause
    exit /b 1
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo WARNING: Python is not installed!
    echo The Python app won't run, but the web server will work.
    echo Download from: https://www.python.org/
    set PYTHON_AVAILABLE=0
) else (
    set PYTHON_AVAILABLE=1
)

echo Checking Node.js version...
node --version

if %PYTHON_AVAILABLE% equ 1 (
    echo Checking Python version...
    python --version
)

echo.
echo Installing Node.js dependencies...
call npm install

if %ERRORLEVEL% neq 0 (
    echo ERROR: Failed to install Node.js dependencies!
    pause
    exit /b 1
)

if %PYTHON_AVAILABLE% equ 1 (
    echo.
    echo Installing Python dependencies...
    cd python_card_app
    call pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo WARNING: Failed to install Python dependencies!
        echo The Python app may not work properly.
    )
    cd ..
)

echo.
echo ========================================
echo   Setup Complete! Starting Server...
echo ========================================
echo.
echo Server will run on: http://localhost:8081
echo Press Ctrl+C to stop the server.
echo.

if %PYTHON_AVAILABLE% equ 1 (
    echo NOTE: To run the Python GUI app, open another terminal and run:
    echo   cd python_card_app
    echo   python main.py
    echo.
    echo NOTE: To test with Stripe webhooks, open another terminal and run:
    echo   stripe login
    echo   stripe listen --forward-to localhost:8081/webhook
    echo.
)

REM Check if .env file exists
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please create a .env file with:
    echo   STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
    echo Download your key from: https://dashboard.stripe.com/
    echo.
)

pause

REM Start the server
node server.js
