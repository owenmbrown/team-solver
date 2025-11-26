/**
 * Main application logic for the web interface
 */

let players = null;
let optimizedTeams = null;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const configSection = document.getElementById('configSection');
const numTeamsInput = document.getElementById('numTeams');
const generationsInput = document.getElementById('generations');
const generationsValue = document.getElementById('generationsValue');
const optimizeBtn = document.getElementById('optimizeBtn');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultsSection = document.getElementById('resultsSection');
const statsGrid = document.getElementById('statsGrid');
const teamsContainer = document.getElementById('teamsContainer');
const exportBtn = document.getElementById('exportBtn');

// Initialize
function init() {
    // Upload area events
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && isValidFileType(file)) {
            handleFile(file);
        } else {
            alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFile(file);
        }
    });
    
    // Configuration events
    generationsInput.addEventListener('input', (e) => {
        generationsValue.textContent = e.target.value;
    });
    
    optimizeBtn.addEventListener('click', runOptimization);
    exportBtn.addEventListener('click', exportResults);
}

function isValidFileType(file) {
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    return validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
}

function handleFile(file) {
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            let csvText;
            
            if (isExcel) {
                // Parse Excel file using SheetJS
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get the first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to CSV format
                csvText = XLSX.utils.sheet_to_csv(worksheet);
            } else {
                // Already CSV
                csvText = e.target.result;
            }
            
            players = parseCSV(csvText);
            
            if (players.length === 0) {
                alert('No valid players found in the file');
                return;
            }
            
            // Show file info
            fileInfo.style.display = 'block';
            fileInfo.innerHTML = `
                <strong>✓ File loaded successfully</strong><br>
                ${players.length} players found<br>
                ${players.filter(p => p.isCoach).length} coaches<br>
                ${Object.keys(groupPlayersByCoAssign(players)).length} car-pool groups
            `;
            
            // Show configuration section
            configSection.style.display = 'block';
            
            // Suggest number of teams
            const suggestedTeams = Math.max(2, Math.floor(players.length / 10));
            numTeamsInput.value = suggestedTeams;
            
        } catch (error) {
            console.error('Error parsing file:', error);
            alert('Error parsing file: ' + error.message);
        }
    };
    
    if (isExcel) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

function groupPlayersByCoAssign(players) {
    const groups = {};
    players.forEach(p => {
        if (p.coAssignGroup !== null) {
            if (!groups[p.coAssignGroup]) {
                groups[p.coAssignGroup] = [];
            }
            groups[p.coAssignGroup].push(p);
        }
    });
    return groups;
}

function runOptimization() {
    if (!players) {
        alert('Please upload a CSV file first');
        return;
    }
    
    const numTeams = parseInt(numTeamsInput.value);
    const generations = parseInt(generationsInput.value);
    
    if (numTeams < 2 || numTeams > 20) {
        alert('Number of teams must be between 2 and 20');
        return;
    }
    
    if (players.length < numTeams * 9) {
        if (!confirm(`Warning: You have ${players.length} players for ${numTeams} teams (recommended: ${numTeams * 9}). Continue anyway?`)) {
            return;
        }
    }
    
    // Show progress section
    progressSection.style.display = 'block';
    resultsSection.style.display = 'none';
    optimizeBtn.disabled = true;
    
    // Run optimization asynchronously
    (async () => {
        try {
            const optimizer = new TeamOptimizer(players, numTeams, {
                populationSize: 300,
                generations: generations,
                onProgress: (progress) => {
                    const percent = (progress.generation / generations) * 100;
                    progressFill.style.width = percent + '%';
                    progressText.textContent = `Generation ${progress.generation}/${generations} - Best Fitness: ${progress.bestFitness.toFixed(2)}`;
                }
            });
            
            optimizedTeams = await optimizer.optimize();
            
            // Display results
            progressText.textContent = 'Optimization complete!';
            setTimeout(() => {
                displayResults(optimizedTeams);
                progressSection.style.display = 'none';
                optimizeBtn.disabled = false;
            }, 500);
            
        } catch (error) {
            console.error('Optimization error:', error);
            alert('An error occurred during optimization: ' + error.message);
            progressSection.style.display = 'none';
            optimizeBtn.disabled = false;
        }
    })();
}

function displayResults(teams) {
    // Calculate overall statistics
    const avgSkills = teams.map(t => t.getAverageSkill());
    const avgAttendances = teams.map(t => t.getAverageAttendance());
    const teamSizes = teams.map(t => t.players.length);
    
    const minSkill = Math.min(...avgSkills);
    const maxSkill = Math.max(...avgSkills);
    const skillDiff = maxSkill - minSkill;
    
    const minAtt = Math.min(...avgAttendances);
    const maxAtt = Math.max(...avgAttendances);
    const attDiff = (maxAtt - minAtt) * 100;
    
    // Display stats grid
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Skill Balance</div>
            <div class="stat-value">${skillDiff.toFixed(2)}</div>
            <div style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">
                Range: ${minSkill.toFixed(1)} - ${maxSkill.toFixed(1)}
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Attendance Balance</div>
            <div class="stat-value">${attDiff.toFixed(1)}%</div>
            <div style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">
                Range: ${(minAtt * 100).toFixed(0)}% - ${(maxAtt * 100).toFixed(0)}%
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Teams Created</div>
            <div class="stat-value">${teams.length}</div>
            <div style="font-size: 0.875rem; opacity: 0.9; margin-top: 0.5rem;">
                Avg ${(teamSizes.reduce((a,b) => a+b, 0) / teams.length).toFixed(1)} players/team
            </div>
        </div>
    `;
    
    // Display teams
    teamsContainer.innerHTML = teams.map(team => {
        const coverage = team.getPositionCoverage();
        const requiredPositions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C', 'OF'];
        
        // Sort players by position then skill
        const sortedPlayers = [...team.players].sort((a, b) => {
            if (a.position !== b.position) {
                return a.position.localeCompare(b.position);
            }
            return b.totalScore - a.totalScore;
        });
        
        return `
            <div class="team-card">
                <div class="team-header">
                    <div class="team-title">Team ${team.teamId + 1}</div>
                    <div class="team-stats">
                        <div class="team-stat">
                            <span class="team-stat-label">Avg Skill</span>
                            <span class="team-stat-value">${team.getAverageSkill().toFixed(1)}</span>
                        </div>
                        <div class="team-stat">
                            <span class="team-stat-label">Avg Attendance</span>
                            <span class="team-stat-value">${(team.getAverageAttendance() * 100).toFixed(0)}%</span>
                        </div>
                        <div class="team-stat">
                            <span class="team-stat-label">Players</span>
                            <span class="team-stat-value">${team.players.length}</span>
                        </div>
                    </div>
                </div>
                
                <div class="position-coverage">
                    ${requiredPositions.map(pos => {
                        const count = coverage[pos];
                        const required = pos === 'OF' ? 3 : 1;
                        const isCovered = count >= required;
                        return `
                            <span class="position-badge ${isCovered ? 'covered' : 'missing'}">
                                ${pos}: ${count}${isCovered ? ' ✓' : ' ✗'}
                            </span>
                        `;
                    }).join('')}
                </div>
                
                <div class="roster">
                    <div class="roster-title">Roster</div>
                    ${sortedPlayers.map(player => `
                        <div class="player-row">
                            <div class="player-name">
                                <span class="player-position">${player.position}</span>
                                ${player.name}
                            </div>
                            <div class="player-badges">
                                ${player.isCoach ? '<span class="badge badge-coach">COACH</span>' : ''}
                                ${player.coAssignGroup ? `<span class="badge badge-group">Group ${player.coAssignGroup}</span>` : ''}
                            </div>
                            <div class="player-stats">
                                <span>Skill: ${player.totalScore.toFixed(1)}</span>
                                <span>Att: ${(player.attendance * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
    
    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function exportResults() {
    if (!optimizedTeams) return;
    
    const data = {
        timestamp: new Date().toISOString(),
        teams: optimizedTeams.map(team => ({
            teamId: team.teamId + 1,
            players: team.players.map(p => ({
                name: p.name,
                position: p.position,
                totalScore: p.totalScore,
                attendance: p.attendance,
                isCoach: p.isCoach,
                coAssignGroup: p.coAssignGroup
            })),
            statistics: {
                avgSkill: team.getAverageSkill(),
                avgAttendance: team.getAverageAttendance(),
                skillVariance: team.getSkillVariance(),
                positionCoverage: team.getPositionCoverage()
            }
        }))
    };
    
    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-assignments-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize app
init();
