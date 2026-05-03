@echo off
REM Quick setup script for Windows developers

echo.
echo ===============================================
echo Throtow - Environment Setup Script (Windows)
echo ===============================================
echo.

REM Check if app/.env.local exists
if exist "app\.env.local" (
    echo ✓ app/.env.local already exists
) else (
    echo Creating app/.env.local from template...
    copy "app\.env.example" "app\.env.local"
    echo ✓ Created app/.env.local
    echo.
    echo NEXT STEPS:
    echo 1. Open app/.env.local
    echo 2. Fill in your Supabase credentials:
    echo    - VITE_SUPABASE_URL
    echo    - VITE_SUPABASE_ANON_KEY
    echo 3. Save the file
    echo.
)

echo ===============================================
echo Environment Setup Complete!
echo ===============================================
echo.
echo Available commands:
echo   npm run dev        - Start development server
echo   npm run build      - Build for production
echo   npm run preview    - Preview production build
echo   npm run check-env  - Verify environment variables
echo.
echo To start developing:
echo   1. Fill app/.env.local with your credentials
echo   2. Run: npm run dev
echo.
