<#
.SYNOPSIS
  MapleStory CMS079 post-modal runtime observer (guest-side, non-invasive).

.DESCRIPTION
  Task 026 evolution of the Task 025 observer. Runs inside the Win7 SP1 x86
  guest (PowerShell 2.0 compatible) and:

  - launches the client exactly like Task 025 (A1 bare / A2 ip port / A3 bat);
  - clicks the Program Compatibility Assistant "Run program" button once;
  - waits for the game-owned modal dialog `#32770` titled `iloveaki`
    (children: Static "iloveaki success." + Button OK);
  - snapshots full pre-click state (modules/threads/windows/children/netstat);
  - clicks the application's own OK button exactly ONCE (authorized normal
    UI action - the only additional interaction);
  - then samples >= PostModalSeconds with 2 Hz process sampling, module
    first-seen tracking for the full game watch list, new-dialog capture
    (record only, never clicked), child-process tracking, 4 s netstat.

  No debugger, no ReadProcessMemory, no thread suspension, no hooks, no
  dumps, no patches. Canonical MapleStory.exe SHA-256
  5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d is
  re-verified at start.

  v2 (T26F2+): all EnumWindows callbacks use the Task-025-proven pattern
  (local ArrayList collection, processing strictly after the native call
  returns, no script-scope writes inside delegates); heartbeat logging
  every 15 ticks; every phase wrapped in try/catch so a single bad sample
  cannot terminate the observer.

.NOTES
  Part of Task 026 (adventure-island). Observe only; never modifies the
  client, never bypasses compatibility or anti-debug mechanisms.
#>
param(
  [string]$RunId = 'T26R0',
  [string]$Mode = 'A1',
  [int]$TotalSeconds = 480,
  [int]$PostModalSeconds = 300,
  [switch]$UseEtw,
  [switch]$NoTouchGate
)
$ErrorActionPreference = 'Continue'
$base = 'C:\t026'
$runDir = Join-Path $base $RunId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Log([string]$msg) {
  try {
    $t = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    Add-Content -Path (Join-Path $runDir 'observer-log.txt') -Value "$t $msg" -Encoding UTF8
    Write-Host ("[T026] {0} {1}" -f $t, $msg)
  } catch {}
}
function Esc([string]$s) {
  if ($null -eq $s) { return '' }
  return ('"' + ($s -replace '"', '""') + '"')
}

Log "observer start runid=$RunId mode=$Mode pid=$PID total=$TotalSeconds postmodal=$PostModalSeconds"

# ---- locate drives --------------------------------------------------------
$Xfer = $null; $Game = $null
foreach ($d in 'D','E','F','G','H','I','J') {
  if ((Test-Path "$($d):\XFER.TAG") -and (-not $Xfer)) { $Xfer = "$($d):" }
  if ((Test-Path "$($d):\MapleStory.exe") -and (-not $Game)) { $Game = "$($d):" }
}
Log "drives xfer=$Xfer game=$Game"
if (-not $Game) { Log 'FATAL no game drive'; exit 1 }

# ---- Win32 helpers --------------------------------------------------------
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class T026Win {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr lp);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
}
'@
function Get-WinText([IntPtr]$h) {
  $sb = New-Object System.Text.StringBuilder 512
  [void][T026Win]::GetWindowText($h, $sb, $sb.Capacity)
  return $sb.ToString()
}
function Get-WinClass([IntPtr]$h) {
  $sb = New-Object System.Text.StringBuilder 256
  [void][T026Win]::GetClassName($h, $sb, $sb.Capacity)
  return $sb.ToString()
}

# ---- gate (read-only environment snapshot) --------------------------------
Log 'phase gate'
try {
  $gateDir = $runDir
  $os = Get-WmiObject Win32_OperatingSystem
  ("Caption={0}" -f $os.Caption)  | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
  ("Version={0} Build={1} SP={2}" -f $os.Version, $os.BuildNumber, $os.ServicePackMajorVersion) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
  ("OSArchitecture={0}" -f $os.OSArchitecture) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
  ("ComputerName={0}" -f $env:COMPUTERNAME) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
  ("GameDrive={0}" -f $Game) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
  certutil -hashfile "$Game\MapleStory.exe" SHA256 | Add-Content -Encoding UTF8 (Join-Path $gateDir 'hash-maplestory.txt')
  if (-not $NoTouchGate) {
    if (Test-Path "$Game\iloveaki.dat") { certutil -hashfile "$Game\iloveaki.dat" SHA256 | Add-Content -Encoding UTF8 (Join-Path $gateDir 'hash-iloveaki.txt') }
    cmd /c ("dir /a /s /b {0}\ >> {1}\client-dir-before.txt 2>&1" -f $Game, $runDir)
  }
  $vi = (Get-Item "$Game\MapleStory.exe").VersionInfo
  $vi | Format-List * | Add-Content -Encoding UTF8 (Join-Path $gateDir 'exe-versioninfo.txt')
  ipconfig /all | Add-Content -Encoding UTF8 (Join-Path $gateDir 'ipconfig-all.txt')
  netstat -ano | Add-Content -Encoding UTF8 (Join-Path $gateDir 'netstat-before.txt')
  tasklist /v | Add-Content -Encoding UTF8 (Join-Path $gateDir 'tasklist-before.txt')
  driverquery | Add-Content -Encoding UTF8 (Join-Path $gateDir 'drivers-before.txt')
  $svcNames = 'SICE','SIWVID','NTICE','oreans32','oreansx64','ehsvc'
  $svcOut = Join-Path $gateDir 'svc-gate-before.txt'
  foreach ($s in $svcNames) { ("=== $s ===") | Add-Content -Encoding UTF8 $svcOut; (sc query $s 2>&1) | Add-Content -Encoding UTF8 $svcOut }
  $regKeys = @(
    'HKCU\Software\WinLicense', 'HKCU\Software\WLkt', 'HKLM\SOFTWARE\WLkt',
    'HKCU\Software\Wine',
    'HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store',
    'HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers',
    'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
  )
  $regOut = Join-Path $gateDir 'reg-gate-before.txt'
  foreach ($k in $regKeys) { ("=== $k ===") | Add-Content -Encoding UTF8 $regOut; (reg query $k /s 2>&1) | Add-Content -Encoding UTF8 $regOut }
} catch { Log ("gate phase error: {0}" -f $_.Exception.Message) }

# ---- CSV headers ----------------------------------------------------------
Add-Content -Encoding UTF8 (Join-Path $runDir 'proc.csv') 'ts,tick,run,pid,cpu_total_s,cpu_user_s,cpu_priv_s,ws_kb,threads,handles,responding,main_window,exited,exit_code'
Add-Content -Encoding UTF8 (Join-Path $runDir 'threads.csv') 'ts,tick,run,pid,tid,startaddr,module,state,waitreason,priority,user_s,priv_s,total_s'
Add-Content -Encoding UTF8 (Join-Path $runDir 'modules-raw.csv') 'ts,tick,run,pid,module,path,base,size'
Add-Content -Encoding UTF8 (Join-Path $runDir 'wins.csv') 'ts,tick,run,pid,class,title,visible'
Add-Content -Encoding UTF8 (Join-Path $runDir 'procs.csv') 'ts,tick,run,name,pid,ppid,cmdline'
Add-Content -Encoding UTF8 (Join-Path $runDir 'module-first-seen.csv') 'ts,run,pid,module,path,base,size,watch'
Add-Content -Encoding UTF8 (Join-Path $runDir 'dialogs.csv') 'ts,run,phase,pid,class,title,children'
Add-Content -Encoding UTF8 (Join-Path $runDir 'net-events.csv') 'ts,run,line'

# module watch list (task 026 mandate)
$watch = @{
  'iloveaki.dat'='repack'; 'ijl15.dll'='repack'; 'MSVCR90.dll'='repack';
  'PCOM.dll'='game'; 'NameSpace.dll'='game'; 'Canvas.dll'='game';
  'ResMan.dll'='game'; 'ZLZ.dll'='game'; 'Gr2D_DX8.dll'='game';
  'Sound_DX8.dll'='game'; 'Shape2D.dll'='game'; 'WzMss.dll'='game';
  'WzFlashRenderer.dll'='game'; 'mss32.dll'='game';
  'ehsvc.dll'='hshield'; 'AspINet.dll'='hshield'; 'aossdk.dll'='hshield';
  'ws2_32.dll'='network'; 'wininet.dll'='network'
}
$script:ModFirstSeen = @{}

if ($UseEtw) {
  Log 'starting builtin ETW kernel logger'
  $etl = Join-Path $runDir 'kernel.etl'
  $lm = "logman start `"NT Kernel Logger`" -ets -o `"$etl`" -p `"Windows Kernel Trace`" 0x06020207 -bs 1024"
  $lmo = (cmd /c $lm 2>&1) -join ' '
  Log ("logman start: {0}" -f $lmo)
}

# ---- launch ---------------------------------------------------------------
Log ("phase launch mode={0}" -f $Mode)
$launchWall = Get-Date
$tick = 0
if ($Mode -eq 'A1') {
  Start-Process -FilePath "$Game\MapleStory.exe" -WorkingDirectory $Game | Out-Null
} elseif ($Mode -eq 'A2') {
  Start-Process -FilePath "$Game\MapleStory.exe" -ArgumentList '127.0.0.1','9555' -WorkingDirectory $Game | Out-Null
} elseif ($Mode -eq 'A3') {
  $bat = Get-ChildItem -Path $Game -Filter '*.bat' | Where-Object { -not $_.PSIsContainer } | Select-Object -First 1
  if ($bat) {
    Start-Process -FilePath $env:comspec -ArgumentList '/c', ('"' + $bat.FullName + '"') -WorkingDirectory $Game | Out-Null
  } else { Log 'FATAL A3 without bat'; exit 1 }
} else {
  Log "FATAL unknown mode $Mode"; exit 1
}
("LAUNCH {0} mode={1} game={2}" -f ($launchWall.ToString('yyyy-MM-dd HH:mm:ss.fff')), $Mode, $Game) | Add-Content -Encoding UTF8 (Join-Path $runDir 'launch.txt')

# ---- wait for process creation (t0) ---------------------------------------
$gamePid = 0; $gamePp = 0; $gameCmd = ''; $t0 = $null
$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
  $w = Get-WmiObject Win32_Process -Filter "Name='MapleStory.exe'"
  if ($w) {
    $first = @($w)[0]
    $gamePid = $first.ProcessId
    $gamePp = $first.ParentProcessId
    $gameCmd = [string]$first.CommandLine
    $t0 = $first.ConvertToDateTime($first.CreationDate)
    break
  }
  Start-Sleep -Milliseconds 400
}
if ($gamePid -eq 0) { Log 'FATAL game process never appeared'; Add-Content -Encoding UTF8 (Join-Path $runDir 'T026-FAILED.TXT') 'no-game-process'; exit 1 }
Log ("t0 game pid={0} ppid={1}" -f $gamePid, $gamePp)
("T0={0}" -f $t0.ToString('yyyy-MM-dd HH:mm:ss.fff')) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("PID={0}" -f $gamePid) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("PPID={0}" -f $gamePp) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("CMDLINE={0}" -f $gameCmd) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')

# ---- state flags ----------------------------------------------------------
$script:PcaSeenDone = $false
$script:PcaClicked = $false
$script:AkiSeen = $false
$script:AkiClicked = $false
$script:AkiClickTime = $null
$script:DialogSeen = @{}
$pcaLog = Join-Path $runDir 'pca.txt'
$akiLog = Join-Path $runDir 'aki.txt'

# ---- PCA watcher (Task 025 pattern, unchanged) -----------------------------
function Check-Pca {
  if ($script:PcaClicked) { return }
  $hits = New-Object System.Collections.ArrayList
  $cb = [T026Win+EnumProc]{
    param($h, $l)
    $cls = Get-WinClass $h
    if ($cls -eq '#32770') {
      $title = Get-WinText $h
      $btns = New-Object System.Collections.ArrayList
      $bcb = [T026Win+EnumProc]{
        param($ch, $cl)
        $t = Get-WinText $ch
        if ($t.Length -gt 0) { [void]$btns.Add(@{ H = $ch; T = $t }) }
        return $true
      }
      [void][T026Win]::EnumChildWindows($h, $bcb, [IntPtr]::Zero)
      $runBtn = [IntPtr]::Zero
      foreach ($b in $btns) { if ($b.T -match '运行程序') { $runBtn = $b.H } }
      if ($runBtn -ne [IntPtr]::Zero) {
        $wpid = [uint32]0
        [void][T026Win]::GetWindowThreadProcessId($h, [ref]$wpid)
        [void]$hits.Add(@{ H = $h; WPid = $wpid; Title = $title; Btn = $runBtn })
      }
    }
    return $true
  }
  [void][T026Win]::EnumWindows($cb, [IntPtr]::Zero)
  if ($hits.Count -gt 0) {
    $hit = $hits[0]
    if (-not $script:PcaSeenDone) {
      $script:PcaSeenDone = $true
      ("PCA_SEEN {0} pid={1} title={2}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $hit.WPid, $hit.Title) | Add-Content -Encoding UTF8 $pcaLog
      Log ("PCA dialog seen pid={0}" -f $hit.WPid)
    }
    [void][T026Win]::SendMessage($hit.Btn, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
    $script:PcaClicked = $true
    ("PCA_CLICK {0} btn=0x{1:x}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $hit.Btn.ToInt32()) | Add-Content -Encoding UTF8 $pcaLog
    Log 'PCA clicked RunProgram'
  }
}

# ---- iloveaki modal watcher (same shape as Check-Pca) ----------------------
# Collects dialogs first; all processing happens after EnumWindows returns.
function Check-Aki {
  if ($script:AkiClicked) { return }
  $hits = New-Object System.Collections.ArrayList
  $cb = [T026Win+EnumProc]{
    param($h, $l)
    $cls = Get-WinClass $h
    if ($cls -eq '#32770') {
      $title = Get-WinText $h
      $wpid = [uint32]0
      [void][T026Win]::GetWindowThreadProcessId($h, [ref]$wpid)
      if ($wpid -eq $gamePid -and $title.Length -gt 0 -and $title -match 'iloveaki') {
        $btns = New-Object System.Collections.ArrayList
        $bcb = [T026Win+EnumProc]{
          param($ch, $cl)
          $t = Get-WinText $ch
          $c = Get-WinClass $ch
          if ($t.Length -gt 0) { [void]$btns.Add(@{ H = $ch; T = $t; C = $c }) }
          return $true
        }
        [void][T026Win]::EnumChildWindows($h, $bcb, [IntPtr]::Zero)
        [void]$hits.Add(@{ H = $h; WPid = $wpid; Title = $title; Kids = $btns })
      }
    }
    return $true
  }
  [void][T026Win]::EnumWindows($cb, [IntPtr]::Zero)
  if ($hits.Count -lt 1) { return }
  $hit = $hits[0]
  if (-not $script:AkiSeen) {
    $script:AkiSeen = $true
    ("AKI_SEEN {0} hwnd=0x{1:x} title={2}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $hit.H.ToInt32(), $hit.Title) | Add-Content -Encoding UTF8 $akiLog
    Log ("iloveaki modal seen hwnd=0x{0:x}" -f $hit.H.ToInt32())
  }
  $kidStr = ''
  foreach ($k in @($hit.Kids)) { $kidStr += ($k.C + ' :: ' + $k.T + ' | ') }
  ("AKI_DIALOG {0} children={1}" -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $kidStr) | Add-Content -Encoding UTF8 $akiLog
  Add-Content -Encoding UTF8 (Join-Path $runDir 'dialogs.csv') ('{0},{1},pre-click,{2},#32770,{3},{4}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $RunId, $gamePid, (Esc $hit.Title), (Esc $kidStr))
  $okBtn = [IntPtr]::Zero
  foreach ($k in @($hit.Kids)) { if ($k.C -eq 'Button' -and $k.T.Length -gt 0) { $okBtn = $k.H } }
  if ($okBtn -ne [IntPtr]::Zero) {
    Snapshot-Full 'pre-aki-click'
    # ---- the single authorized click of the application's own OK button ----
    [void][T026Win]::SendMessage($okBtn, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
    $script:AkiClicked = $true
    $script:AkiClickTime = Get-Date
    ("AKI_CLICK {0} btn=0x{1:x}" -f $script:AkiClickTime.ToString('yyyy-MM-dd HH:mm:ss.fff'), $okBtn.ToInt32()) | Add-Content -Encoding UTF8 $akiLog
    Log ("iloveaki OK clicked (once) btn=0x{0:x}" -f $okBtn.ToInt32())
  }
}

# ---- new-dialog watcher (record only) ---------------------------------------
function Check-NewDialogs {
  $rows = New-Object System.Collections.ArrayList
  $cb = [T026Win+EnumProc]{
    param($h, $l)
    $cls = Get-WinClass $h
    $title = Get-WinText $h
    $wpid = [uint32]0
    [void][T026Win]::GetWindowThreadProcessId($h, [ref]$wpid)
    $vis = [T026Win]::IsWindowVisible($h)
    if ($vis -and $title.Length -gt 0 -and $title -ne 'Default IME' -and $title -ne 'MSCTFIME UI') {
      [void]$rows.Add(@{ H = $h; WPid = $wpid; Cls = $cls; Title = $title })
    }
    return $true
  }
  [void][T026Win]::EnumWindows($cb, [IntPtr]::Zero)
  foreach ($r in @($rows)) {
    if ($r.WPid -ne $gamePid -and $r.Cls -ne '#32770') { continue }
    $key = ("{0}:{1}:{2}" -f $r.WPid, $r.Cls, $r.Title)
    if (-not $script:DialogSeen.ContainsKey($key)) {
      $script:DialogSeen[$key] = $true
      $kids = New-Object System.Collections.ArrayList
      $kcb = [T026Win+EnumProc]{
        param($ch, $cl)
        $t = Get-WinText $ch
        $c = Get-WinClass $ch
        if ($t.Length -gt 0) { [void]$kids.Add(($c + ' :: ' + $t)) }
        return $true
      }
      [void][T026Win]::EnumChildWindows($r.H, $kcb, [IntPtr]::Zero)
      Add-Content -Encoding UTF8 (Join-Path $runDir 'dialogs.csv') ('{0},{1},post-click,{2},{3},{4},{5}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $RunId, $r.WPid, (Esc $r.Cls), (Esc $r.Title), (Esc (($kids -join ' | '))))
      Log ("new visible window pid={0} class={1} title={2}" -f $r.WPid, $r.Cls, $r.Title)
    }
  }
}

# ---- full snapshot helper ---------------------------------------------------
function Snapshot-Full([string]$tag) {
  try {
    $t = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    Log ("snapshot {0}" -f $tag)
    Add-Content -Encoding UTF8 (Join-Path $runDir 'snapshots.txt') ("===== {0} {1} =====" -f $t, $tag)
    try {
      $gp = [System.Diagnostics.Process]::GetProcessById($gamePid)
      $gp.Refresh()
      Add-Content -Encoding UTF8 (Join-Path $runDir 'snapshots.txt') ("cpu={0:F3}s ws={1}KB threads={2} handles={3} responding={4} mainwin={5}" -f $gp.TotalProcessorTime.TotalSeconds, [int]($gp.WorkingSet64/1024), $gp.Threads.Count, $gp.HandleCount, $gp.Responding, $gp.MainWindowTitle)
      foreach ($m in @($gp.Modules)) {
        try {
          $nm = [IO.Path]::GetFileName($m.FileName)
          $wk = ''
          if ($watch.ContainsKey($nm)) { $wk = $watch[$nm] }
          if (-not $script:ModFirstSeen.ContainsKey($nm)) {
            $script:ModFirstSeen[$nm] = $true
            Add-Content -Encoding UTF8 (Join-Path $runDir 'module-first-seen.csv') ('{0},{1},{2},{3},{4},0x{5:x8},{6},{7}' -f $t, $RunId, $gamePid, $nm, (Esc $m.FileName), $m.BaseAddress.ToInt32(), $m.ModuleMemorySize, $wk)
          }
        } catch {}
      }
    } catch { Add-Content -Encoding UTF8 (Join-Path $runDir 'snapshots.txt') 'process-gone' }
    $w = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $gamePid -or $_.Name -match 'HSUpdate|ASPLnchr|Patcher|Setup' }
    foreach ($p in @($w)) {
      if ($null -eq $p) { continue }
      Add-Content -Encoding UTF8 (Join-Path $runDir 'snapshots.txt') ("PROC {0} pid={1} ppid={2} cmd={3}" -f $p.Name, $p.ProcessId, $p.ParentProcessId, $p.CommandLine)
    }
    $n = netstat -ano 2>$null
    foreach ($line in $n) { if ("$line" -match '^\s*TCP') { $l = "$line".Trim(); if ($l -match ("\s{0}\s" -f $gamePid)) { Add-Content -Encoding UTF8 (Join-Path $runDir 'snapshots.txt') ("SOCKET {0}" -f $l) } } }
  } catch { Log ("snapshot error: {0}" -f $_.Exception.Message) }
}

# ---- window sampler (Task 025 pattern) --------------------------------------
$script:Wts = ''; $script:WTick = 0; $script:WRun = $RunId
$wcb = [T026Win+EnumProc]{
  param($h, $l)
  $title = Get-WinText $h
  $cls = Get-WinClass $h
  if ($title.Length -gt 0 -or $cls -eq '#32770') {
    $wpid = [uint32]0
    [void][T026Win]::GetWindowThreadProcessId($h, [ref]$wpid)
    $vis = [T026Win]::IsWindowVisible($h)
    Add-Content -Encoding UTF8 (Join-Path $runDir 'wins.csv') ('{0},{1},{2},{3},{4},{5},{6}' -f $script:Wts, $script:WTick, $script:WRun, $wpid, (Esc $cls), (Esc $title), $vis)
  }
  return $true
}
function Sample-Windows([string]$ts, [int]$tk) {
  $script:Wts = $ts; $script:WTick = $tk
  [void][T026Win]::EnumWindows($wcb, [IntPtr]::Zero)
  $gameRows = New-Object System.Collections.ArrayList
  $gcb = [T026Win+EnumProc]{
    param($h, $l)
    $wpid = [uint32]0
    [void][T026Win]::GetWindowThreadProcessId($h, [ref]$wpid)
    if ($wpid -eq $gamePid) {
      $title = Get-WinText $h
      [void]$gameRows.Add(('TOP class={0} title={1} visible={2}' -f (Get-WinClass $h), $title, [T026Win]::IsWindowVisible($h)))
      $kids = New-Object System.Collections.ArrayList
      $kcb = [T026Win+EnumProc]{
        param($ch, $cl)
        $t = Get-WinText $ch
        $c = Get-WinClass $ch
        if ($t.Length -gt 0) { [void]$kids.Add(($c + ' :: ' + $t)) }
        return $true
      }
      [void][T026Win]::EnumChildWindows($h, $kcb, [IntPtr]::Zero)
      foreach ($k in @($kids)) { [void]$gameRows.Add(('  CHILD {0}' -f $k)) }
    }
    return $true
  }
  [void][T026Win]::EnumWindows($gcb, [IntPtr]::Zero)
  foreach ($r in @($gameRows)) {
    Add-Content -Encoding UTF8 (Join-Path $runDir 'game-windows.txt') ('{0} {1}' -f $ts, $r)
  }
}

# ---- module table ----------------------------------------------------------
$script:ModRanges = @()
function Build-ModTable($gp) {
  $script:ModRanges = @()
  try {
    foreach ($m in $gp.Modules) {
      try {
        $lo = $m.BaseAddress.ToInt32()
        $sz = $m.ModuleMemorySize
        $script:ModRanges += @{ Lo = $lo; Hi = ($lo + $sz); Name = $m.ModuleName }
      } catch {}
    }
  } catch {}
}
function Module-Of([int]$addr) {
  foreach ($r in $script:ModRanges) {
    if ($addr -ge $r.Lo -and $addr -lt $r.Hi) { return $r.Name }
  }
  return 'unknown'
}

# ---- tracked process sampler ------------------------------------------------
function Sample-Procs([string]$ts, [int]$tk) {
  $w = Get-WmiObject Win32_Process -Filter "Name='MapleStory.exe' OR Name='HSUpdate.exe' OR Name='ASPLnchr.exe' OR Name='Patcher.exe' OR Name='Setup.exe' OR Name='pcaui.exe' OR Name='consent.exe'"
  foreach ($p in @($w)) {
    if ($null -eq $p) { continue }
    if ($p.Name -eq 'MapleStory.exe' -or $p.ParentProcessId -eq $gamePid -or $p.Name -match 'HSUpdate|ASPLnchr|Patcher|Setup|pcaui|consent') {
      Add-Content -Encoding UTF8 (Join-Path $runDir 'procs.csv') ('{0},{1},{2},{3},{4},{5},{6}' -f $ts, $tk, $RunId, $p.Name, $p.ProcessId, $p.ParentProcessId, (Esc ([string]$p.CommandLine)))
    }
  }
}

# ---- main loop ---------------------------------------------------------------
Log ("phase sampling {0}s" -f $TotalSeconds)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$nextSample = 0
$nextNet = 0
$netInterval = 4
while ($sw.Elapsed.TotalSeconds -lt $TotalSeconds) {
  try { $tick++; Check-Pca } catch { Log ("pca error: {0}" -f $_.Exception.Message) }
  if ($script:PcaClicked) {
    try { if (-not $script:AkiClicked) { Check-Aki } } catch { Log ("aki error: {0}" -f $_.Exception.Message) }
    try { if ($script:AkiClicked) { Check-NewDialogs } } catch { Log ("dlg error: {0}" -f $_.Exception.Message) }
  }
  if ($script:AkiClicked -and $sw.Elapsed.TotalSeconds -ge $TotalSeconds -and $script:AkiClickTime -and ((Get-Date) - $script:AkiClickTime).TotalSeconds -lt $PostModalSeconds) {
    Start-Sleep -Milliseconds 350
    continue
  }
  $elapsed = $sw.Elapsed.TotalSeconds
  if ($elapsed -ge $nextSample) {
    $nextSample = [Math]::Floor($elapsed / 2.0) * 2.0 + 2.0
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    try {
      $gp = $null
      try { $gp = [System.Diagnostics.Process]::GetProcessById($gamePid) } catch {}
      if ($gp) {
        $gp.Refresh()
        $cu = 0.0; $ck = 0.0; $ct = 0.0; $ws = 0; $thn = 0; $hd = 0; $resp = ''; $mwt = ''; $exc = 0; $ec = ''
        try { $ct = $gp.TotalProcessorTime.TotalSeconds } catch {}
        try { $cu = $gp.UserProcessorTime.TotalSeconds } catch {}
        try { $ck = $gp.PrivilegedProcessorTime.TotalSeconds } catch {}
        try { $ws = $gp.WorkingSet64 } catch {}
        try { $thn = $gp.Threads.Count } catch {}
        try { $hd = $gp.HandleCount } catch {}
        try { $resp = $gp.Responding } catch {}
        try { $mwt = $gp.MainWindowTitle } catch {}
        try { if ($gp.HasExited) { $exc = 1; try { $ec = $gp.ExitCode } catch {} } } catch {}
        Add-Content -Encoding UTF8 (Join-Path $runDir 'proc.csv') ('{0},{1},{2},{3},{4:F3},{5:F3},{6:F3},{7},{8},{9},{10},{11},{12},{13}' -f $ts, $tick, $RunId, $gamePid, $ct, $cu, $ck, [int]($ws/1024), $thn, $hd, $resp, (Esc $mwt), $exc, $ec)
        if ($thn -gt 0) {
          Build-ModTable $gp
          foreach ($th in @($gp.Threads)) {
            try {
              $sa = 0
              try { $sa = $th.StartAddress.ToInt32() } catch {}
              $saHex = ('0x{0:x8}' -f $sa)
              $mod = '?'
              if ($sa -ne 0) { $mod = Module-Of $sa } else { $mod = 'zero' }
              $st = ''; try { $st = [string]$th.ThreadState } catch {}
              $wr = ''; try { $wr = [string]$th.WaitReason } catch {}
              $pr = ''; try { $pr = [string]$th.PriorityLevel } catch {}
              $tu = 0.0; $tp = 0.0; $tt = 0.0
              try { $tu = $th.UserProcessorTime.TotalSeconds } catch {}
              try { $tp = $th.PrivilegedProcessorTime.TotalSeconds } catch {}
              try { $tt = $th.TotalProcessorTime.TotalSeconds } catch {}
              Add-Content -Encoding UTF8 (Join-Path $runDir 'threads.csv') ('{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10:F3},{11:F3},{12:F3}' -f $ts, $tick, $RunId, $gamePid, $th.Id, $saHex, $mod, $st, $wr, $pr, $tu, $tp, $tt)
            } catch {}
          }
          foreach ($m in @($gp.Modules)) {
            try {
              $lo = $m.BaseAddress.ToInt32()
              $nm = [IO.Path]::GetFileName($m.FileName)
              $wk = ''
              if ($watch.ContainsKey($nm)) { $wk = $watch[$nm] }
              if (-not $script:ModFirstSeen.ContainsKey($nm)) {
                $script:ModFirstSeen[$nm] = $true
                Add-Content -Encoding UTF8 (Join-Path $runDir 'module-first-seen.csv') ('{0},{1},{2},{3},{4},0x{5:x8},{6},{7}' -f $ts, $RunId, $gamePid, $nm, (Esc $m.FileName), $lo, $m.ModuleMemorySize, $wk)
              }
              Add-Content -Encoding UTF8 (Join-Path $runDir 'modules-raw.csv') ('{0},{1},{2},{3},{4},{5},0x{6:x8},{7}' -f $ts, $tick, $RunId, $gamePid, $m.ModuleName, (Esc $m.FileName), $lo, $m.ModuleMemorySize)
            } catch {}
          }
        }
      } else {
        Add-Content -Encoding UTF8 (Join-Path $runDir 'proc.csv') ('{0},{1},{2},{3},,,,,,,,"process-gone",1,' -f $ts, $tick, $RunId, $gamePid)
      }
    } catch { Log ("sample error: {0}" -f $_.Exception.Message) }
    try { Sample-Windows $ts $tick } catch { Log ("winsample error: {0}" -f $_.Exception.Message) }
    try { Sample-Procs $ts $tick } catch { Log ("procsample error: {0}" -f $_.Exception.Message) }
    if ($script:AkiClicked -and ($tick % 15 -eq 0)) { Snapshot-Full ("post-click tick {0}" -f $tick) }
    if ($tick % 15 -eq 0) { Log ("alive tick={0} elapsed={1:F0}s aki={2}" -f $tick, $elapsed, $script:AkiClicked) }
  }
  if ($elapsed -ge $nextNet) {
    $nextNet = [Math]::Floor($elapsed / $netInterval) * $netInterval + $netInterval
    try {
      $n = netstat -ano 2>$null
      $nf = Join-Path $runDir 'net-filtered.txt'
      ("===== tick {0} {1} =====" -f $tick, (Get-Date).ToString('HH:mm:ss')) | Add-Content -Encoding UTF8 $nf
      foreach ($line in $n) {
        if ("$line" -match '^\s*TCP') {
          $l = "$line".Trim()
          if ($l -match ("\s{0}\s" -f $gamePid) -or $l -match ':9555|:7575|:7576|:7577|:7578|:8600') {
            Add-Content -Encoding UTF8 $nf $l
            Add-Content -Encoding UTF8 (Join-Path $runDir 'net-events.csv') ('{0},{1},{2}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff'), $RunId, (Esc $l))
          }
        }
      }
    } catch { Log ("net error: {0}" -f $_.Exception.Message) }
  }
  Start-Sleep -Milliseconds 350
}
Log 'phase sampling-done'

# ---- stop ETW ---------------------------------------------------------------
if ($UseEtw) {
  Log 'stopping ETW kernel logger'
  $lmo = (cmd /c 'logman stop "NT Kernel Logger" -ets' 2>&1) -join ' '
  Log ("logman stop: {0}" -f $lmo)
}

# ---- post -------------------------------------------------------------------
Log 'phase post'
try {
  $wm = Get-WmiObject Win32_Process -Filter "Name='MapleStory.exe'"
  if ($wm) { foreach ($p in @($wm)) { ("AFTER Name={0} Pid={1} Ppid={2} Cmd={3}" -f $p.Name, $p.ProcessId, $p.ParentProcessId, $p.CommandLine) | Add-Content -Encoding UTF8 (Join-Path $runDir 'wmic-after.txt') } }
  tasklist /v | Add-Content -Encoding UTF8 (Join-Path $runDir 'tasklist-after.txt')
  tasklist /m /fi "imagename eq MapleStory.exe" | Add-Content -Encoding UTF8 (Join-Path $runDir 'modules-final.txt')
  netstat -ano | Add-Content -Encoding UTF8 (Join-Path $runDir 'netstat-after.txt')
  driverquery | Add-Content -Encoding UTF8 (Join-Path $runDir 'drivers-after.txt')
  wevtutil qe Application "/q:*[System[Provider[@Name='Microsoft-Windows-ApplicationExperienceInfrastructure']]]" /c:10 /rd:true /f:text | Add-Content -Encoding UTF8 (Join-Path $runDir 'ev-appexp.txt') 2>$null
  wevtutil qe Application /c:25 /rd:true /f:text | Add-Content -Encoding UTF8 (Join-Path $runDir 'ev-application.txt') 2>$null
  wevtutil qe System /c:15 /rd:true /f:text | Add-Content -Encoding UTF8 (Join-Path $runDir 'ev-system.txt') 2>$null
  wevtutil qe Microsoft-Windows-CodeIntegrity/Operational /c:10 /rd:true /f:text | Add-Content -Encoding UTF8 (Join-Path $runDir 'ev-ci.txt') 2>$null
  $regOut2 = Join-Path $runDir 'reg-after.txt'
  foreach ($k in $regKeys) { ("=== $k ===") | Add-Content -Encoding UTF8 $regOut2; (reg query $k /s 2>&1) | Add-Content -Encoding UTF8 $regOut2 }
  $svcOut2 = Join-Path $runDir 'svc-after.txt'
  foreach ($s in $svcNames) { ("=== $s ===") | Add-Content -Encoding UTF8 $svcOut2; (sc query $s 2>&1) | Add-Content -Encoding UTF8 $svcOut2 }
  cmd /c ("dir /a /s /b {0}\ >> {1}\client-dir-after.txt 2>&1" -f $Game, $runDir)
  $kids = Get-WmiObject Win32_Process | Where-Object { $_.ParentProcessId -eq $gamePid -or $_.Name -match 'HSUpdate|ASPLnchr|Patcher|Setup' }
  foreach ($p in @($kids)) { if ($null -ne $p) { ("FINALCHILD {0} pid={1} ppid={2} cmd={3}" -f $p.Name, $p.ProcessId, $p.ParentProcessId, $p.CommandLine) | Add-Content -Encoding UTF8 (Join-Path $runDir 'children-after.txt') } }
} catch { Log ("post error: {0}" -f $_.Exception.Message) }
Log 'observer complete'
('DONE {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff')) | Add-Content -Encoding UTF8 (Join-Path $runDir 'OBS-DONE.TXT')
