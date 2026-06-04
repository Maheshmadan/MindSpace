# Setup script to create a silent launcher and a Windows Desktop shortcut for MindSpace

$ProjectDir = (Get-Location).Path
$VbsPath = Join-Path $ProjectDir "launch.vbs"

# 1. Create the silent VBScript launcher
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "$ProjectDir"
WshShell.Run "npm start", 0, false
"@
[System.IO.File]::WriteAllText($VbsPath, $VbsContent)

# 2. Create a beautiful Windows Desktop Shortcut pointing to the VBScript launcher
$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "MindSpace.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsPath`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "Launch MindSpace (Zero-knowledge extension to your mind)"
$Shortcut.IconLocation = "$ProjectDir\node_modules\electron\dist\electron.exe, 0"
$Shortcut.Save()

Write-Host "=============================================="
Write-Host "✅ Silent launcher (launch.vbs) created in project root!"
Write-Host "✅ Desktop shortcut 'MindSpace' created successfully!"
Write-Host "=============================================="
