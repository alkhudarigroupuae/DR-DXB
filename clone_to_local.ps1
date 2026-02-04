# Syria Pay - Clone to Local PC
# Usage: powershell -ExecutionPolicy Bypass -File clone_to_local.ps1

Write-Host ""
Write-Host "========================================"
Write-Host "   Syria Pay - Clone to Local PC"
Write-Host "========================================"
Write-Host ""

$destination = Read-Host "Enter destination folder (e.g., C:\Users\YourName\SyriaPay)"

if (Test-Path $destination) {
    $continue = Read-Host "Folder exists. Continue? (Y/N)"
    if ($continue -ne "Y") { exit }
} else {
    New-Item -ItemType Directory -Path $destination | Out-Null
    Write-Host "Created folder: $destination"
}

Write-Host ""
Write-Host "Copying files..."

# Copy root files
Copy-Item "z:\package.json" "$destination\" -Force
Copy-Item "z:\README.md" "$destination\" -Force
Copy-Item "z:\.env.example" "$destination\" -Force
Copy-Item "z:\start.bat" "$destination\" -Force
Copy-Item "z:\server_simple.js" "$destination\server.js" -Force

# Copy web_card_app
if (-not (Test-Path "$destination\web_card_app")) {
    New-Item -ItemType Directory -Path "$destination\web_card_app" | Out-Null
}
Copy-Item "z:\web_card_app\*" "$destination\web_card_app\" -Force -Recurse

# Copy python_card_app
if (-not (Test-Path "$destination\python_card_app")) {
    New-Item -ItemType Directory -Path "$destination\python_card_app" | Out-Null
}
Copy-Item "z:\python_card_app\*" "$destination\python_card_app\" -Force -Recurse

Write-Host ""
Write-Host "========================================"
Write-Host "   Clone Complete!"
Write-Host "========================================"
Write-Host ""
Write-Host "Location: $destination"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Open folder in VS Code: code '$destination'"
Write-Host "2. Run: npm install"
Write-Host "3. Create .env file with STRIPE_SECRET_KEY"
Write-Host "4. Run: npm start"
Write-Host ""
