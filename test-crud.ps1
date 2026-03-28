# CRUD Testing Script for HR Management System
param([string]$BaseUrl = "http://localhost:5000/api")

# Color output helper
function Write-Status { param([string]$Message, [string]$Type = "Info")
  $color = @{"Success"="Green";"Error"="Red";"Info"="Cyan";"Warning"="Yellow"}[$Type]
  Write-Host $Message -ForegroundColor $color
}

# Setup
$headers = @{"Content-Type" = "application/json"}
$loginData = @{email="admin@hr.local"; password="admin123"} | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "$BaseUrl/auth/login" -Method POST -Headers $headers -Body $loginData -UseBasicParsing
$token = ($loginResp.Content | ConvertFrom-Json).accessToken
$authHeaders = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
Write-Status "[OK] Authenticated as admin@hr.local" "Success"

# Track test results
$results = @()

# ===== DEPARTMENTS CRUD =====
Write-Host "`n=== DEPARTMENTS CRUD ===" -ForegroundColor Magenta

try {
  # CREATE
  $newDept = @{name="Test Marketing Dept $(Get-Random)"; head="admin@hr.local"} | ConvertTo-Json
  $createDeptResp = (Invoke-WebRequest -Uri "$BaseUrl/departments" -Method POST -Headers $authHeaders -Body $newDept -UseBasicParsing).Content | ConvertFrom-Json
  $deptId = if ($createDeptResp.id) { $createDeptResp.id } else { $createDeptResp._id }
  Write-Status "[OK] CREATE Department: $($createDeptResp.name)" "Success"
  $results += "Department CREATE"
  
  # READ
  $getDept = (Invoke-WebRequest -Uri "$BaseUrl/departments/$deptId" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] READ Department: $($getDept.name)" "Success"
  $results += "Department READ"
  
  # UPDATE
  $updateDept = @{name="Updated $(Get-Random)"; head="admin@hr.local"} | ConvertTo-Json
  $updateResp = (Invoke-WebRequest -Uri "$BaseUrl/departments/$deptId" -Method PUT -Headers $authHeaders -Body $updateDept -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] UPDATE Department: to $($updateResp.name)" "Success"
  $results += "Department UPDATE"
  
  # LIST
  $deptList = (Invoke-WebRequest -Uri "$BaseUrl/departments" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] LIST Departments: $($deptList.Count) total" "Success"
  $results += "Department LIST"
} catch {
  Write-Status "[FAIL] Department CRUD failed: $_" "Error"
}

# ===== TEAMS CRUD =====
Write-Host "`n=== TEAMS CRUD ===" -ForegroundColor Magenta

try {
  # CREATE Team
  $newTeam = @{name="DevOps Team $(Get-Random)"; departmentId=$deptId; managerEmail="admin@hr.local"} | ConvertTo-Json
  $createTeamResp = (Invoke-WebRequest -Uri "$BaseUrl/teams" -Method POST -Headers $authHeaders -Body $newTeam -UseBasicParsing).Content | ConvertFrom-Json
  $teamId = if ($createTeamResp.team.id) { $createTeamResp.team.id } elseif ($createTeamResp.team._id) { $createTeamResp.team._id } elseif ($createTeamResp.id) { $createTeamResp.id } else { $createTeamResp._id }
  Write-Status "[OK] CREATE Team: $($createTeamResp.name)" "Success"
  $results += "Team CREATE"
  
  # READ Team
  $getTeam = (Invoke-WebRequest -Uri "$BaseUrl/teams/$teamId" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] READ Team: $($getTeam.name)" "Success"
  $results += "Team READ"
  
  # UPDATE Team
  $updateTeam = @{name="Updated Team $(Get-Random)"; departmentId=$deptId; managerEmail="admin@hr.local"} | ConvertTo-Json
  $updateTeamResp = (Invoke-WebRequest -Uri "$BaseUrl/teams/$teamId" -Method PUT -Headers $authHeaders -Body $updateTeam -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] UPDATE Team: to $($updateTeamResp.name)" "Success"
  $results += "Team UPDATE"
  
  # LIST Teams
  $teamList = (Invoke-WebRequest -Uri "$BaseUrl/teams" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] LIST Teams: $($teamList.Count) total" "Success"
  $results += "Team LIST"
} catch {
  Write-Status "[FAIL] Team CRUD failed: $_" "Error"
}

# ===== POSITIONS CRUD =====
Write-Host "`n=== POSITIONS CRUD ===" -ForegroundColor Magenta

try {
  # CREATE Position
  $newPos = @{title="Senior Developer $(Get-Random)"; level="Senior"; departmentId=$deptId; teamId=$teamId} | ConvertTo-Json
  $createPosResp = (Invoke-WebRequest -Uri "$BaseUrl/positions" -Method POST -Headers $authHeaders -Body $newPos -UseBasicParsing).Content | ConvertFrom-Json
  $posId = if ($createPosResp.position.id) { $createPosResp.position.id } elseif ($createPosResp.position._id) { $createPosResp.position._id } elseif ($createPosResp.id) { $createPosResp.id } else { $createPosResp._id }
  Write-Status "[OK] CREATE Position: $($createPosResp.title)" "Success"
  $results += "Position CREATE"
  
  # READ Position
  $getPos = (Invoke-WebRequest -Uri "$BaseUrl/positions/$posId" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] READ Position: $($getPos.title)" "Success"
  $results += "Position READ"
  
  # UPDATE Position
  $updatePos = @{title="Updated Position $(Get-Random)"; level="Lead"; departmentId=$deptId} | ConvertTo-Json
  $updatePosResp = (Invoke-WebRequest -Uri "$BaseUrl/positions/$posId" -Method PUT -Headers $authHeaders -Body $updatePos -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] UPDATE Position: to $($updatePosResp.title)" "Success"
  $results += "Position UPDATE"
  
  # LIST Positions
  $posList = (Invoke-WebRequest -Uri "$BaseUrl/positions" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] LIST Positions: $($posList.Count) total" "Success"
  $results += "Position LIST"
} catch {
  $errMsg = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $_.Exception.Message }
  Write-Status "[FAIL] Position CRUD failed: $errMsg" "Error"
}

# ===== EMPLOYEES CRUD =====
Write-Host "`n=== EMPLOYEES CRUD ===" -ForegroundColor Magenta

try {
  # CREATE Employee
  $newEmp = @{fullName="Test Employee $(Get-Random)"; email="emp$(Get-Random)@example.com"; department=$deptId; position=$posId} | ConvertTo-Json
  $createEmpResp = (Invoke-WebRequest -Uri "$BaseUrl/employees" -Method POST -Headers $authHeaders -Body $newEmp -UseBasicParsing).Content | ConvertFrom-Json
  $empId = if ($createEmpResp.employee.id) { $createEmpResp.employee.id } elseif ($createEmpResp.employee._id) { $createEmpResp.employee._id } elseif ($createEmpResp.id) { $createEmpResp.id } else { $createEmpResp._id }
  Write-Status "[OK] CREATE Employee: $($createEmpResp.fullName)" "Success"
  $results += "Employee CREATE"
  
  # READ Employee
  $getEmp = (Invoke-WebRequest -Uri "$BaseUrl/employees/$empId" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] READ Employee: $($getEmp.fullName)" "Success"
  $results += "Employee READ"
  
  # UPDATE Employee
  $updateEmp = @{fullName="Updated Employee $(Get-Random)"; email=$getEmp.email; department=$deptId; position=$posId} | ConvertTo-Json
  $updateEmpResp = (Invoke-WebRequest -Uri "$BaseUrl/employees/$empId" -Method PUT -Headers $authHeaders -Body $updateEmp -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] UPDATE Employee: to $($updateEmpResp.fullName)" "Success"
  $results += "Employee UPDATE"
  
  # LIST Employees
  $empList = (Invoke-WebRequest -Uri "$BaseUrl/employees" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] LIST Employees: $($empList.Count) total" "Success"
  $results += "Employee LIST"
} catch {
  Write-Status "[FAIL] Employee CRUD failed: $_" "Error"
}

# ===== EMPLOYMENTS (ASSIGNMENTS) =====
Write-Host "`n=== EMPLOYMENTS (ASSIGNMENTS) ===" -ForegroundColor Magenta

try {
  # ASSIGN Employee
  $assignData = @{employeeId=$empId; departmentId=$deptId; teamId=$teamId; positionId=$posId; isPrimary=$true} | ConvertTo-Json
  $assignResp = (Invoke-WebRequest -Uri "$BaseUrl/employments/assign" -Method POST -Headers $authHeaders -Body $assignData -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] ASSIGN Employee to Department/Team/Position" "Success"
  $results += "Employment ASSIGN"
  
  # GET Employee Assignments
  $getAssign = (Invoke-WebRequest -Uri "$BaseUrl/employments/employee/$empId" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] GET Employee Assignments: $($getAssign.Count) assignments" "Success"
  $results += "Employment GET"
} catch {
  $errMsg = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $_.Exception.Message }
  Write-Status "[FAIL] Employment operations failed: $errMsg" "Error"
}

# ===== REPORTS =====
Write-Host "`n=== REPORTS ===" -ForegroundColor Magenta

try {
  # GET Summary Report
  $reportResp = (Invoke-WebRequest -Uri "$BaseUrl/reports/summary" -Method GET -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] GET Reports Summary" "Success"
  Write-Status "  - Departments: $($reportResp.summary.departments.total)" "Info"
  Write-Status "  - Teams: $($reportResp.summary.teams.total)" "Info"
  Write-Status "  - Positions: $($reportResp.summary.positions.total)" "Info"
  Write-Status "  - Employees: $($reportResp.summary.employees.total)" "Info"
  $results += "Reports SUMMARY"
} catch {
  Write-Status "[FAIL] Reports failed: $_" "Error"
}

# ===== DELETE OPERATIONS =====
Write-Host "`n=== DELETE OPERATIONS ===" -ForegroundColor Magenta

try {
  # DELETE Employee
  $delEmpResp = (Invoke-WebRequest -Uri "$BaseUrl/employees/$empId" -Method DELETE -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] DELETE Employee" "Success"
  $results += "Employee DELETE"
  
  # DELETE Position
  $delPosResp = (Invoke-WebRequest -Uri "$BaseUrl/positions/$posId" -Method DELETE -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] DELETE Position" "Success"
  $results += "Position DELETE"
  
  # DELETE Team
  $delTeamResp = (Invoke-WebRequest -Uri "$BaseUrl/teams/$teamId" -Method DELETE -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] DELETE Team" "Success"
  $results += "Team DELETE"
  
  # DELETE Department
  $delDeptResp = (Invoke-WebRequest -Uri "$BaseUrl/departments/$deptId" -Method DELETE -Headers $authHeaders -UseBasicParsing).Content | ConvertFrom-Json
  Write-Status "[OK] DELETE Department" "Success"
  $results += "Department DELETE"
} catch {
  $errMsg = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $_.Exception.Message }
  Write-Status "[FAIL] Delete operations failed: $errMsg" "Error"
}

# ===== SUMMARY =====
Write-Host "`n=== TEST SUMMARY ===" -ForegroundColor Green
$results | ForEach-Object { Write-Host "  [PASS] $_" }
Write-Host "`nTotal: $($results.Count) / 20 operations passed" -ForegroundColor Green
