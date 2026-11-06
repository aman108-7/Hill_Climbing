@echo off
setlocal
cd /d "%~dp0"

py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 goto try_python
py -3 run_local.py
goto finished

:try_python
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 goto try_python3
python run_local.py
goto finished

:try_python3
python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>&1
if errorlevel 1 goto missing_python
python3 run_local.py
goto finished

:missing_python
echo Python 3.8 or newer is required.
echo Install Python from https://www.python.org/downloads/ then try again.
echo You can also run: py -3 run_local.py

:finished
pause
endlocal
