' blog-autostart.vbs - 开机静默启动博客本地服务（无黑窗口）
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = dir & "\start-blog.bat"
' 0 = 隐藏窗口, False = 不等待结束
WshShell.Run """" & batPath & """", 0, False
