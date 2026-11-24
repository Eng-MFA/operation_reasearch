@echo off
title Push OptiVerse to GitHub
color 0A
chcp 65001 >nul

echo =====================================================================
echo            رفع مشروع OptiVerse بالكامل إلى GitHub
echo =====================================================================
echo.
echo هذا السكربت سيرفع جميع ملفات المشروع:
echo   - الباك إند بالكامل (Backend & Exact Solvers)
echo   - الفرونت إند بالكامل (Frontend, React, Tailwind, KaTeX)
echo   - كافة صفحات التطبيق الـ 25 والسكربتات والتقارير
echo.

set /p REPO_URL="انسخ رابط المستودع الخاص بك من GitHub والصقه هنا ثم اضغط Enter: "

if "%REPO_URL%"=="" (
    echo.
    echo [خطأ] لم تقم بإدخال الرابط! يرجى إعادة تشغيل الملف وإدخال الرابط.
    pause
    exit /b
)

echo.
echo [1/3] فحص وإعداد المستودع المحلي...
cd /d "%~dp0"
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

echo [2/3] حفظ أي تعديلات جديدة...
git add .
git commit -m "Complete OptiVerse OR & Mathematical Optimization Platform (Backend + Frontend)" >nul 2>&1

echo [3/3] جاري رفع المشروع بالكامل إلى فرع main على GitHub...
git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo =====================================================================
    echo   [تم بنجاح] تم رفع المشروع بالكامل (الباك إند والفرونت إند) إلى GitHub!
    echo =====================================================================
) else (
    echo =====================================================================
    echo   [ملاحظة] إذا طلب منك GitHub تسجيل الدخول، يرجى إتمام التسجيل في النافذة.
    echo =====================================================================
)
echo.
pause
