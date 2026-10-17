@REM ----------------------------------------------------------------------------
@REM Maven Wrapper Batch Script for SkillSwap Campus
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set "MAVEN_HOME=C:\Users\DELL\maven\apache-maven-3.9.9"

if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    "%MAVEN_HOME%\bin\mvn.cmd" %*
) else (
    mvn %*
)
