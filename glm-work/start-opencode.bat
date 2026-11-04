@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

if not defined GLM_API_KEY call :load_user_key
if not defined GLM_API_KEY call :load_machine_key
if not defined ZAI_API_KEY set "ZAI_API_KEY=%GLM_API_KEY%"
if not defined ZHIPU_API_KEY set "ZHIPU_API_KEY=%GLM_API_KEY%"

set "OPENCODE_CONFIG=%~dp0opencode.json"

set "OPENCODE=%USERPROFILE%\.opencode\bin\opencode2.cmd"
if not exist "%OPENCODE%" set "OPENCODE=opencode"

"%OPENCODE%" --standalone --session ses_edb24f216ffeLsadviowS94u1r --prompt "Read and follow glm-work/prompt.md exactly. Create or modify files only inside research/glm-work/."
endlocal
exit /b

:load_user_key
for /f "tokens=1,2*" %%A in ('reg query "HKCU\Environment" /v GLM_API_KEY 2^>nul') do (
  if /I "%%A"=="GLM_API_KEY" set "GLM_API_KEY=%%C"
)
exit /b

:load_machine_key
for /f "tokens=1,2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v GLM_API_KEY 2^>nul') do (
  if /I "%%A"=="GLM_API_KEY" set "GLM_API_KEY=%%C"
)
exit /b
