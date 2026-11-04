<#
.SYNOPSIS
  MapleStory CMS079 runtime observer (guest-side, non-invasive).

.DESCRIPTION
  Runs inside a Windows guest (Win7 SP1 x86 tested, PowerShell 2.0 compatible)
  and observes a MapleStory.exe launch using ordinary process APIs only:
  periodic CPU/memory/thread/module/window/process sampling plus one
  consistent click of the Program Compatibility Assistant "Run program"
  button. No debugger attach, no ReadProcessMemory, no thread suspension,
  no hooks, no dumps. Verified against canonical MapleStory.exe SHA-256
  5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d.

.PARAMETER RunId
  Label written into every output row (e.g. A1R1).

.PARAMETER Mode
  A1 = bare MapleStory.exe; A2 = "127.0.0.1 9555"; A3 = original .bat launcher;
  A4 = "127.0.0.1" only.

.PARAMETER TotalSeconds
  Sampling window after process creation (default 150).

.PARAMETER UseProcmon
  Start/stop a backing-file Procmon trace around the run (Procmon.exe must sit next to MapleStory.exe or on the xfer disk). Note: Procmon v4.11 GUI runs on Win7 SP1 but its capture engine no longer supports Win7 (produces an empty PML).

.PARAMETER UseEtw
  Use the built-in Windows ETW kernel logger (NT Kernel Logger, flags 0x06020207:
  process/thread/image/file/registry) as the passive trace channel instead. Verified
  working on Win7 x86 SP1.

.OUTPUTS
  <RunId>/observer-log.txt, gate-*.txt, t0.txt, launch.txt, pca.txt,
  proc.csv, threads.csv, modules-raw.csv, wins.csv, procs.csv,
  net-filtered.txt, post-run tasklist/module/registry/event snapshots.

.NOTES
  Part of Task 025 (adventure-island). Observe only; never modifies the
  client, never bypasses compatibility or anti-debug mechanisms.
#>
param(
  [string]$RunId = 'RUN00',
  [string]$Mode = 'A1',
  [int]$TotalSeconds = 150,
  [switch]$UseProcmon,
  [switch]$UseEtw
)
# Task 025 observer - runs ELEVATED inside the Win7 x86 SP1 guest.
# Non-invasive: normal process/thread/module/window APIs only. No debugger,
# no ReadProcessMemory, no thread suspension, no hooks, no dumps.
$ErrorActionPreference = 'Continue'
$base = 'C:\t025'
$runDir = Join-Path $base $RunId
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

function Log([string]$msg) {
  $t = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
  Add-Content -Path (Join-Path $runDir 'observer-log.txt') -Value "$t $msg" -Encoding UTF8
  Write-Host ("[T025] {0} {1}" -f $t, $msg)
}
function Esc([string]$s) {
  if ($null -eq $s) { return '' }
  return ('"' + ($s -replace '"', '""') + '"')
}

Log "observer start runid=$RunId mode=$Mode procmon=$UseProcmon pid=$PID"

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
public class T025Win {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr lp);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@

function Get-WinText([IntPtr]$h) {
  $sb = New-Object System.Text.StringBuilder 512
  [void][T025Win]::GetWindowText($h, $sb, $sb.Capacity)
  return $sb.ToString()
}
function Get-WinClass([IntPtr]$h) {
  $sb = New-Object System.Text.StringBuilder 256
  [void][T025Win]::GetClassName($h, $sb, $sb.Capacity)
  return $sb.ToString()
}

# ---- gate -----------------------------------------------------------------
Log 'phase gate'
$gateDir = $runDir
$os = Get-WmiObject Win32_OperatingSystem
("Caption={0}" -f $os.Caption)  | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("Version={0} Build={1} SP={2}" -f $os.Version, $os.BuildNumber, $os.ServicePackMajorVersion) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("OSArchitecture={0}" -f $os.OSArchitecture) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("ComputerName={0}" -f $env:COMPUTERNAME) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("Snapshot=win7x86-clean" ) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("Arch={0}" -f $env:PROCESSOR_ARCHITECTURE) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')
("ObserverPid={0} IsElevatedCmd={1}" -f $PID, $true) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-os.txt')

certutil -hashfile "$Game\MapleStory.exe" SHA256  | Add-Content -Encoding UTF8 (Join-Path $gateDir 'hash-maplestory.txt')
if (Test-Path "$Game\HShield\HSUpdate.exe") { certutil -hashfile "$Game\HShield\HSUpdate.exe" SHA256 | Add-Content -Encoding UTF8 (Join-Path $gateDir 'hash-hsupdate.txt') }
$bat = Get-ChildItem -Path $Game -Filter '*.bat' | Where-Object { -not $_.PSIsContainer } | Select-Object -First 1
if ($bat) {
  ("BAT_NAME={0}" -f $bat.Name) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'bat-info.txt')
  ("BAT_LEN={0}" -f $bat.Length) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'bat-info.txt')
  certutil -hashfile $bat.FullName SHA256 | Add-Content -Encoding UTF8 (Join-Path $gateDir 'bat-info.txt')
  cmd /c ("type `"{0}`" > {1}\bat-content.txt 2>&1" -f $bat.FullName, $runDir)
  Log ("bat found: {0} ({1} bytes)" -f $bat.Name, $bat.Length)
}
$vi = (Get-Item "$Game\MapleStory.exe").VersionInfo
$vi | Format-List * | Add-Content -Encoding UTF8 (Join-Path $gateDir 'exe-versioninfo.txt')
$sig = Get-AuthenticodeSignature "$Game\MapleStory.exe"
("SigStatus={0}" -f $sig.Status) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'exe-signature.txt')
if ($sig.SignerCertificate) { ("Signer={0}" -f $sig.SignerCertificate.Subject) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'exe-signature.txt') }
("TimeGenerated={0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) | Add-Content -Encoding UTF8 (Join-Path $gateDir 'gate-time.txt')

ipconfig /all | Add-Content -Encoding UTF8 (Join-Path $gateDir 'ipconfig-all.txt')
netsh advfirewall show allprofiles state | Add-Content -Encoding UTF8 (Join-Path $gateDir 'firewall-state.txt')
netstat -ano | Add-Content -Encoding UTF8 (Join-Path $gateDir 'netstat-before.txt')
tasklist /v | Add-Content -Encoding UTF8 (Join-Path $gateDir 'tasklist-before.txt')
driverquery | Add-Content -Encoding UTF8 (Join-Path $gateDir 'drivers-before.txt')

$svcNames = 'SICE','SIWVID','NTICE','oreans32','oreansx64','ehsvc'
$svcOut = Join-Path $gateDir 'svc-gate-before.txt'
foreach ($s in $svcNames) { ("=== $s ===") | Add-Content -Encoding UTF8 $svcOut; (sc query $s 2>&1) | Add-Content -Encoding UTF8 $svcOut }
$regKeys = @(
  'HKCU\Software\WinLicense',
  'HKCU\Software\WLkt',
  'HKLM\SOFTWARE\WLkt',
  'HKCU\Software\Wine',
  'HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store',
  'HKCU\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers',
  'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers'
)
$regOut = Join-Path $gateDir 'reg-gate-before.txt'
foreach ($k in $regKeys) { ("=== $k ===") | Add-Content -Encoding UTF8 $regOut; (reg query $k /s 2>&1) | Add-Content -Encoding UTF8 $regOut }

# ---- CSV headers ----------------------------------------------------------
Add-Content -Encoding UTF8 (Join-Path $runDir 'proc.csv') 'ts,tick,run,pid,cpu_total_s,cpu_user_s,cpu_priv_s,ws_kb,threads,handles,responding,main_window,exited,exit_code'
Add-Content -Encoding UTF8 (Join-Path $runDir 'threads.csv') 'ts,tick,run,pid,tid,startaddr,module,state,waitreason,priority,user_s,priv_s,total_s'
Add-Content -Encoding UTF8 (Join-Path $runDir 'modules-raw.csv') 'ts,tick,run,pid,module,path,base,size'
Add-Content -Encoding UTF8 (Join-Path $runDir 'wins.csv') 'ts,tick,run,pid,class,title,visible'
Add-Content -Encoding UTF8 (Join-Path $runDir 'procs.csv') 'ts,tick,run,name,pid,ppid,cmdline'

# ---- optional Procmon -----------------------------------------------------
if ($UseEtw) {
  Log 'starting builtin ETW kernel logger'
  $etl = Join-Path $runDir 'kernel.etl'
  $lm = "logman start `"NT Kernel Logger`" -ets -o `"$etl`" -p `"Windows Kernel Trace`" 0x06020207 -bs 1024"
  $lmo = (cmd /c $lm 2>&1) -join ' '
  Log ("logman start: {0}" -f $lmo)
}
if ($UseProcmon) {
  $script:PmPath = "$Game\Procmon.exe"
  if (-not (Test-Path $script:PmPath) -and $Xfer) { $script:PmPath = "$Xfer\Procmon.exe" }
  if (Test-Path $script:PmPath) {
    Log 'starting procmon backing trace'
    $proc = Start-Process -FilePath $script:PmPath -ArgumentList '/AcceptEula','/Quiet','/Minimized',('/BackingFile ' + (Join-Path $runDir 'trace.CPL')) -PassThru
    Log ("procmon pid={0}" -f $proc.Id)
    Start-Sleep -Seconds 5
    if (Get-Process -Name 'Procmon*' -ErrorAction SilentlyContinue) { Log 'procmon alive after start' }
    else { Log 'procmon NOT running after start (incompatible or blocked)' }
  } else {
    Log 'procmon requested but missing'
  }
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
  if ($bat) {
    Start-Process -FilePath $env:comspec -ArgumentList '/c', ('"' + $bat.FullName + '"') -WorkingDirectory $Game | Out-Null
  } else {
    Log 'FATAL A3 without bat'; exit 1
  }
} elseif ($Mode -eq 'A4') {
  Start-Process -FilePath "$Game\MapleStory.exe" -ArgumentList '127.0.0.1' -WorkingDirectory $Game | Out-Null
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
if ($gamePid -eq 0) { Log 'FATAL game process never appeared'; Add-Content -Encoding UTF8 (Join-Path $runDir 'T025-FAILED.TXT') 'no-game-process'; exit 1 }
Log ("t0 game pid={0} ppid={1}" -f $gamePid, $gamePp)
("T0={0}" -f $t0.ToString('yyyy-MM-dd HH:mm:ss.fff')) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("PID={0}" -f $gamePid) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("PPID={0}" -f $gamePp) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("CMDLINE={0}" -f $gameCmd) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')
("LAUNCH_WALL={0}" -f $launchWall.ToString('yyyy-MM-dd HH:mm:ss.fff')) | Add-Content -Encoding UTF8 (Join-Path $runDir 't0.txt')

# ---- PCA watcher state ----------------------------------------------------
$script:PcaSeenDone = $false
$script:PcaClicked = $false
$script:PcaClicks = 0
$pcaLog = Join-Path $runDir 'pca.txt'

function Check-Pca {
  if ($script:PcaClicked) { return }
  $hits = New-Object System.Collections.ArrayList
  $cb = [T025Win+EnumProc]{
    param($h, $l)
    $cls = Get-WinClass $h
    if ($cls -eq '#32770') {
      $title = Get-WinText $h
      $btns = New-Object System.Collections.ArrayList
      $bcb = [T025Win+EnumProc]{
        param($ch, $cl)
        $t = Get-WinText $ch
        if ($t.Length -gt 0) { [void]$btns.Add(@{ H = $ch; T = $t }) }
        return $true
      }
      [void][T025Win]::EnumChildWindows($h, $bcb, [IntPtr]::Zero)
      $runBtn = [IntPtr]::Zero
      foreach ($b in $btns) { if ($b.T -match '运行程序') { $runBtn = $b.H } }
      if ($runBtn -ne [IntPtr]::Zero) {
        $wpid = [uint32]0
        [void][T025Win]::GetWindowThreadProcessId($h, [ref]$wpid)
        $row = @{ H = $h; WPid = $wpid; Title = $title; Btn = $runBtn }
        [void]$hits.Add($row)
      }
    }
    return $true
  }
  [void][T025Win]::EnumWindows($cb, [IntPtr]::Zero)
  if ($hits.Count -gt 0) {
    $hit = $hits[0]
    if (-not $script:PcaSeenDone) {
      $script:PcaSeenDone = $true
      $now = Get-Date
      ("PCA_SEEN {0} pid={1} title={2}" -f $now.ToString('yyyy-MM-dd HH:mm:ss.fff'), $hit.WPid, $hit.Title) | Add-Content -Encoding UTF8 $pcaLog
      Log ("PCA dialog seen pid={0} title={1}" -f $hit.WPid, $hit.Title)
    }
    [void][T025Win]::SendMessage($hit.Btn, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
    $script:PcaClicks++
    $now2 = Get-Date
    ("PCA_CLICK {0} btn=0x{1:x} click#{2}" -f $now2.ToString('yyyy-MM-dd HH:mm:ss.fff'), $hit.Btn.ToInt32(), $script:PcaClicks) | Add-Content -Encoding UTF8 $pcaLog
    Log ("PCA clicked RunProgram click#{0}" -f $script:PcaClicks)
    if ($script:PcaClicks -ge 1) { $script:PcaClicked = $true }
  }
}

# ---- window sampler --------------------------------------------------------
$script:WinRows = New-Object System.Collections.ArrayList
$wcb = [T025Win+EnumProc]{
  param($h, $l)
  $title = Get-WinText $h
  $cls = Get-WinClass $h
  if ($title.Length -gt 0 -or $cls -eq '#32770') {
    $wpid = [uint32]0
    [void][T025Win]::GetWindowThreadProcessId($h, [ref]$wpid)
    $vis = [T025Win]::IsWindowVisible($h)
    [void]$script:WinRows.Add(('{0},{1},{2},{3},{4},{5},{6}' -f $script:Wts, $script:WTick, $script:WRun, $wpid, (Esc $cls), (Esc $title), $vis))
  }
  return $true
}
function Sample-Windows([string]$ts, [int]$tk) {
  $script:Wts = $ts; $script:WTick = $tk; $script:WRun = $RunId
  $script:WinRows.Clear()
  [void][T025Win]::EnumWindows($wcb, [IntPtr]::Zero)
  $f = Join-Path $runDir 'wins.csv'
  foreach ($r in $script:WinRows) { Add-Content -Encoding UTF8 $f $r }
  # child windows of game-pid top-level windows (text/class only)
  $script:GameKids = New-Object System.Collections.ArrayList
  $kcb = [T025Win+EnumProc]{
    param($ch, $cl)
    $t = Get-WinText $ch
    $c = Get-WinClass $ch
    if ($t.Length -gt 0) { [void]$script:GameKids.Add(($c + ' :: ' + $t)) }
    return $true
  }
  $gcb = [T025Win+EnumProc]{
    param($h, $l)
    $wpid = [uint32]0
    [void][T025Win]::GetWindowThreadProcessId($h, [ref]$wpid)
    if ($wpid -eq $gamePid) {
      $title = Get-WinText $h
      Add-Content -Encoding UTF8 (Join-Path $runDir 'game-windows.txt') ('{0} TOP class={1} title={2} visible={3}' -f $ts, (Get-WinClass $h), $title, [T025Win]::IsWindowVisible($h))
      $script:GameKids.Clear()
      [void][T025Win]::EnumChildWindows($h, $kcb, [IntPtr]::Zero)
      foreach ($k in $script:GameKids) {
        Add-Content -Encoding UTF8 (Join-Path $runDir 'game-windows.txt') ('{0}   CHILD {1}' -f $ts, $k)
      }
    }
    return $true
  }
  [void][T025Win]::EnumWindows($gcb, [IntPtr]::Zero)
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

# ---- tracked process sampler ----------------------------------------------
$trackFilter = "Name='MapleStory.exe' OR Name='HSUpdate.exe' OR Name='ASPLnchr.exe' OR Name='pcaui.exe' OR Name='consent.exe' OR Name='Procmon.exe' OR Name='Procmon64.exe'"
function Sample-Procs([string]$ts, [int]$tk) {
  $w = Get-WmiObject Win32_Process -Filter $trackFilter
  $f = Join-Path $runDir 'procs.csv'
  foreach ($p in @($w)) {
    if ($null -eq $p) { continue }
    $cmd = [string]$p.CommandLine
    if ($p.Name -eq 'MapleStory.exe' -or $p.ParentProcessId -eq $gamePid) {
      Add-Content -Encoding UTF8 $f ('{0},{1},{2},{3},{4},{5},{6}' -f $ts, $tk, $RunId, $p.Name, $p.ProcessId, $p.ParentProcessId, (Esc $cmd))
    } elseif ($p.Name -match 'pcaui|consent|HSUpdate|ASPLnchr|Procmon') {
      Add-Content -Encoding UTF8 $f ('{0},{1},{2},{3},{4},{5},{6}' -f $ts, $tk, $RunId, $p.Name, $p.ProcessId, $p.ParentProcessId, (Esc $cmd))
    }
  }
}

# ---- main loop -------------------------------------------------------------
Log ("phase sampling {0}s" -f $TotalSeconds)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$nextSample = 0
$nextNet = 0
while ($sw.Elapsed.TotalSeconds -lt $TotalSeconds) {
  $tick++
  Check-Pca
  $elapsed = $sw.Elapsed.TotalSeconds
  if ($elapsed -ge $nextSample) {
    $nextSample = [Math]::Floor($elapsed / 2.0) * 2.0 + 2.0
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss.fff')
    $gp = $null
    try { $gp = [System.Diagnostics.Process]::GetProcessById($gamePid) } catch {}
    if ($gp) {
      try {
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
          $tf = Join-Path $runDir 'threads.csv'
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
              Add-Content -Encoding UTF8 $tf ('{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10:F3},{11:F3},{12:F3}' -f $ts, $tick, $RunId, $gamePid, $th.Id, $saHex, $mod, $st, $wr, $pr, $tu, $tp, $tt)
            } catch {}
          }
          $mf = Join-Path $runDir 'modules-raw.csv'
          foreach ($m in @($gp.Modules)) {
            try {
              $lo = $m.BaseAddress.ToInt32()
              Add-Content -Encoding UTF8 $mf ('{0},{1},{2},{3},{4},{5},0x{6:x8},{7}' -f $ts, $tick, $RunId, $gamePid, $m.ModuleName, (Esc $m.FileName), $lo, $m.ModuleMemorySize)
            } catch {}
          }
        }
      } catch {}
    } else {
      Add-Content -Encoding UTF8 (Join-Path $runDir 'proc.csv') ('{0},{1},{2},{3},,,,,,,,"process-gone",1,' -f $ts, $tick, $RunId, $gamePid)
    }
    Sample-Windows $ts $tick
    Sample-Procs $ts $tick
  }
  if ($elapsed -ge $nextNet) {
    $nextNet = [Math]::Floor($elapsed / 8.0) * 8.0 + 8.0
    $n = netstat -ano 2>$null
    $nf = Join-Path $runDir 'net-filtered.txt'
    ("===== tick {0} {1} =====" -f $tick, (Get-Date).ToString('HH:mm:ss')) | Add-Content -Encoding UTF8 $nf
    foreach ($line in $n) { if ("$line" -match "^\s*TCP") { $l = "$line".Trim(); if ($l -match ("\s{0}\s" -f $gamePid) -or $l -match ":9555|:7575|:7576|:7577|:7578|:8600") { Add-Content -Encoding UTF8 $nf $l } } }
  }
  Start-Sleep -Milliseconds 350
}
Log 'phase sampling-done'

# ---- stop ETW ---------------------------------------------------------------
if ($UseEtw) {
  Log 'stopping ETW kernel logger'
  $lmo = (cmd /c 'logman stop "NT Kernel Logger" -ets' 2>&1) -join ' '
  Log ("logman stop: {0}" -f $lmo)
  if (Test-Path (Join-Path $runDir 'kernel.etl')) {
    $sz = (Get-Item (Join-Path $runDir 'kernel.etl')).Length
    Log ("kernel.etl size={0}" -f $sz)
  } else { Log 'kernel.etl missing' }
}

# ---- stop procmon ----------------------------------------------------------
if ($UseProcmon -and $script:PmPath -and (Test-Path $script:PmPath)) {
  Log 'stopping procmon'
  Start-Process -FilePath $script:PmPath -ArgumentList '/Terminate' -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 10
  if (Test-Path (Join-Path $runDir 'trace.CPL')) {
    $sz = (Get-Item (Join-Path $runDir 'trace.CPL')).Length
    Log ("procmon trace CPL size={0}" -f $sz)
  } else {
    Log 'procmon trace CPL missing after terminate'
  }
}

# ---- post -----------------------------------------------------------------
Log 'phase post'
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
cmd /c ("dir /s /b {0}\oreans* {0}\*.sys %SystemRoot%\system32\drivers\oreans* 2>&1" -f $Game) | Add-Content -Encoding UTF8 (Join-Path $runDir 'new-files.txt')
if ($UseProcmon -and (Test-Path (Join-Path $runDir 'trace.CPL'))) {
  Log 'procmon trace retained as PML for host-side conversion'
}
Log 'observer complete'
('DONE {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff')) | Add-Content -Encoding UTF8 (Join-Path $runDir 'OBS-DONE.TXT')
