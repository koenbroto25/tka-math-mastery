@echo off
echo ==========================================
echo      TKA MATH MASTERY - GIT SYNC
echo ==========================================
echo.

echo [1/3] Adding changes...
git add .

echo [2/3] Committing changes...
set /p commit_msg="Enter commit message (Press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Auto-sync update"
git commit -m "%commit_msg%"

echo [3/3] Pushing to GitHub...
git push -u origin main

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Push failed. Please check your internet connection or credentials.
    pause
    exit /b %errorlevel%
)

echo [SUCCESS] All changes synced to GitHub!
pause