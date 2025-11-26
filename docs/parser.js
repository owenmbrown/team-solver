/**
 * CSV Parser for player data
 */

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const players = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        
        // Skip league average row
        if (values[0] === 'League Avg' || !values[0]) continue;
        
        const player = parsePlayer(values, headers);
        if (player) {
            players.push(player);
        }
    }
    
    return players;
}

function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    
    return values;
}

function parsePlayer(values, headers) {
    // Map CSV columns to indices
    const getIndex = (name) => headers.indexOf(name);
    
    const name = values[0] || '';
    if (!name) return null;
    
    const position = values[1] || 'OF';
    
    // Parse numeric values with defaults
    const parseNum = (val, defaultVal = 0) => {
        if (!val || val === '') return defaultVal;
        const num = parseFloat(val);
        return isNaN(num) ? defaultVal : num;
    };
    
    const parseIntSafe = (val, defaultVal = 0) => {
        if (!val || val === '') return defaultVal;
        const num = Math.floor(parseFloat(val));
        return isNaN(num) ? defaultVal : num;
    };
    
    // Parse coach status
    const coachVal = values[12] || '';
    const isCoach = coachVal.toUpperCase() === 'Y';
    
    // Parse co-assign group
    let coAssignGroup = null;
    const coAssignVal = values[13] || '';
    if (coAssignVal && coAssignVal !== '') {
        const parsed = parseIntSafe(coAssignVal);
        if (!isNaN(parsed) && parsed > 0) {
            coAssignGroup = parsed;
        }
    }
    
    return new Player({
        name: name,
        position: position,
        battingAverage: parseIntSafe(values[2]),
        slugging: parseIntSafe(values[3]),
        offensiveTotal: parseIntSafe(values[4]),
        efficiency: parseIntSafe(values[5]),
        range: parseIntSafe(values[6]),
        defensiveTotal: parseIntSafe(values[7]),
        baseRunning: parseIntSafe(values[8]),
        totalScore: parseNum(values[9]),
        attendance: parseNum(values[10], 1.0),
        totalWithAttendance: parseNum(values[11]),
        isCoach: isCoach,
        coAssignGroup: coAssignGroup
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseCSV };
}

