@echo off
echo SNMP Test Script for Windows
echo ============================
echo.

if "%1"=="" (
    echo Usage: test-snmp.bat ^<host^> ^<version^> [community] [username] [authPass] [privPass]
    echo.
    echo Examples:
    echo   test-snmp.bat 192.168.1.1 2c public
    echo   test-snmp.bat 192.168.1.1 3 - SNMPv3User SNMPpass SNMPprivpass
    echo.
    pause
    exit /b 1
)

set NODE_OPTIONS=--openssl-legacy-provider
node scripts/testSnmp.js %*
pause
