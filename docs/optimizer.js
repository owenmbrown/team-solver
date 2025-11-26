/**
 * Softball Team Optimizer - JavaScript Implementation
 * Genetic algorithm for optimal team balancing
 */

class Player {
    constructor(data) {
        this.name = data.name;
        this.position = data.position;
        this.battingAverage = data.battingAverage || 0;
        this.slugging = data.slugging || 0;
        this.offensiveTotal = data.offensiveTotal || 0;
        this.efficiency = data.efficiency || 0;
        this.range = data.range || 0;
        this.defensiveTotal = data.defensiveTotal || 0;
        this.baseRunning = data.baseRunning || 0;
        this.totalScore = data.totalScore || 0;
        this.attendance = data.attendance || 1.0;
        this.totalWithAttendance = data.totalWithAttendance || 0;
        this.isCoach = data.isCoach || false;
        this.coAssignGroup = data.coAssignGroup || null;
    }

    isOutfielder() {
        return this.position === 'CF' || this.position === 'OF';
    }

    canPlayPosition(pos) {
        if (pos === 'OF' && this.isOutfielder()) {
            return true;
        }
        return this.position === pos;
    }
}

class Team {
    constructor(teamId) {
        this.teamId = teamId;
        this.players = [];
    }

    addPlayer(player) {
        this.players.push(player);
    }

    getAverageSkill() {
        if (this.players.length === 0) return 0;
        const sum = this.players.reduce((acc, p) => acc + p.totalScore, 0);
        return sum / this.players.length;
    }

    getAverageAttendance() {
        if (this.players.length === 0) return 0;
        const sum = this.players.reduce((acc, p) => acc + p.attendance, 0);
        return sum / this.players.length;
    }

    getSkillVariance() {
        if (this.players.length < 2) return 0;
        const avg = this.getAverageSkill();
        const squaredDiffs = this.players.map(p => Math.pow(p.totalScore - avg, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / this.players.length;
    }

    getPositionCount(position) {
        if (position === 'OF') {
            return this.players.filter(p => p.isOutfielder()).length;
        }
        return this.players.filter(p => p.position === position).length;
    }

    hasCoach() {
        return this.players.some(p => p.isCoach);
    }

    getPositionCoverage() {
        return {
            'SS': this.getPositionCount('SS'),
            'CF': this.getPositionCount('CF'),
            '2B': this.getPositionCount('2B'),
            '3B': this.getPositionCount('3B'),
            'P': this.getPositionCount('P'),
            '1B': this.getPositionCount('1B'),
            'C': this.getPositionCount('C'),
            'OF': this.getPositionCount('OF')
        };
    }
}

class TeamOptimizer {
    constructor(players, numTeams, options = {}) {
        this.players = players;
        this.numTeams = numTeams;
        this.numPlayers = players.length;
        this.populationSize = options.populationSize || 300;
        this.generations = options.generations || 500;
        
        // Build co-assign groups
        this.coAssignGroups = this.buildCoAssignGroups();
        
        // Track best fitness for progress reporting
        this.bestFitness = Infinity;
        this.onProgress = options.onProgress || null;
    }

    buildCoAssignGroups() {
        const groups = {};
        this.players.forEach((player, idx) => {
            if (player.coAssignGroup !== null) {
                if (!groups[player.coAssignGroup]) {
                    groups[player.coAssignGroup] = [];
                }
                groups[player.coAssignGroup].push(idx);
            }
        });
        return groups;
    }

    createIndividual() {
        const individual = new Array(this.numPlayers).fill(0);
        const assigned = new Array(this.numPlayers).fill(false);

        // Assign co-assign groups together
        for (const [groupId, playerIndices] of Object.entries(this.coAssignGroups)) {
            const team = Math.floor(Math.random() * this.numTeams);
            playerIndices.forEach(idx => {
                individual[idx] = team;
                assigned[idx] = true;
            });
        }

        // Assign remaining players
        for (let i = 0; i < this.numPlayers; i++) {
            if (!assigned[i]) {
                individual[i] = Math.floor(Math.random() * this.numTeams);
            }
        }

        return individual;
    }

    decodeIndividual(individual) {
        const teams = Array.from({ length: this.numTeams }, (_, i) => new Team(i));
        
        individual.forEach((teamId, playerIdx) => {
            teams[teamId].addPlayer(this.players[playerIdx]);
        });

        return teams;
    }

    evaluate(individual) {
        const teams = this.decodeIndividual(individual);
        let penalty = 0;

        // Check position constraints (HIGHEST priority - absolute requirements)
        const requiredPositions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C'];
        teams.forEach(team => {
            // Each required position must have at least 1 player
            requiredPositions.forEach(pos => {
                const count = team.getPositionCount(pos);
                if (count < 1) {
                    penalty += 10000; // CRITICAL penalty for missing position
                }
            });


            // Need at least 3 total OF (including CF)
            const totalOF = team.getPositionCount('OF');
            if (totalOF < 3) {
                penalty += 5000 * (3 - totalOF);
            }

            // Minimum team size
            if (team.players.length < 9) {
                penalty += 2000 * (9 - team.players.length);
            }
        });

        // Check co-assign constraint
        for (const [groupId, playerIndices] of Object.entries(this.coAssignGroups)) {
            const teamsForGroup = new Set(playerIndices.map(idx => individual[idx]));
            if (teamsForGroup.size > 1) {
                penalty += 500; // Huge penalty for splitting groups
            }
        }

        // Check team size balance - all teams must be within 1 player of each other
        const teamSizes = teams.map(t => t.players.length);
        const minSize = Math.min(...teamSizes);
        const maxSize = Math.max(...teamSizes);
        if (maxSize - minSize > 1) {
            // Massive penalty for size imbalance (higher priority than skill balance)
            penalty += 3000 * (maxSize - minSize - 1);
        }

        // Skill balance
        const avgSkills = teams.map(t => t.getAverageSkill());
        const skillVariance = this.variance(avgSkills);

        // Attendance balance
        const avgAttendances = teams.map(t => t.getAverageAttendance());
        const attendanceVariance = this.variance(avgAttendances);

        // Within-team variance
        const withinTeamVariances = teams.map(t => t.getSkillVariance());
        const avgWithinVariance = withinTeamVariances.reduce((a, b) => a + b, 0) / teams.length;

        // Coach distribution - spread coaches as evenly as possible across teams
        const totalCoaches = this.players.filter(p => p.isCoach).length;
        let coachPenalty = 0;
        
        if (totalCoaches > 0) {
            // Count coaches per team
            const coachesPerTeam = teams.map(t => t.players.filter(p => p.isCoach).length);
            
            if (totalCoaches >= this.numTeams) {
                // We have enough coaches for all teams - each team should have exactly 1
                coachesPerTeam.forEach(count => {
                    if (count === 0) {
                        coachPenalty += 50; // Heavy penalty for team without coach
                    } else if (count > 1) {
                        coachPenalty += 30 * (count - 1); // Penalty for multiple coaches
                    }
                });
            } else {
                // Fewer coaches than teams - but still spread them out
                // No team should have more than 1 coach
                coachesPerTeam.forEach(count => {
                    if (count > 1) {
                        coachPenalty += 50 * (count - 1); // Heavy penalty for multiple coaches
                    }
                });
            }
        }

        // Combined fitness
        // Prioritize skill balance (want difference < 1.0) but not at expense of hard constraints
        const fitness = penalty +
            skillVariance * 50.0 +  // Increased from 2.0 to 50.0 for tighter skill balance
            attendanceVariance * 10.0 +  // Reduced from 100.0 to 10.0
            avgWithinVariance * 0.5 +
            coachPenalty;

        return fitness;
    }

    variance(values) {
        if (values.length < 2) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }

    crossover(ind1, ind2) {
        const offspring1 = [...ind1];
        const offspring2 = [...ind2];

        if (Math.random() < 0.7) {
            // Get non-co-assigned indices
            const nonCoAssign = [];
            for (let i = 0; i < this.numPlayers; i++) {
                const isCoAssigned = Object.values(this.coAssignGroups).some(group => group.includes(i));
                if (!isCoAssigned) {
                    nonCoAssign.push(i);
                }
            }

            if (nonCoAssign.length > 2) {
                const point1 = Math.floor(Math.random() * nonCoAssign.length);
                const point2 = point1 + Math.floor(Math.random() * (nonCoAssign.length - point1));

                for (let i = point1; i < point2; i++) {
                    const idx = nonCoAssign[i];
                    [offspring1[idx], offspring2[idx]] = [offspring2[idx], offspring1[idx]];
                }
            }
        }

        // Repair both offspring to ensure constraints
        this.repairIndividual(offspring1);
        this.repairIndividual(offspring2);

        return [offspring1, offspring2];
    }

    mutate(individual) {
        const mutated = [...individual];
        const mutationRate = 0.1;

        // Get non-co-assigned indices
        const nonCoAssign = [];
        for (let i = 0; i < this.numPlayers; i++) {
            const isCoAssigned = Object.values(this.coAssignGroups).some(group => group.includes(i));
            if (!isCoAssigned) {
                nonCoAssign.push(i);
            }
        }

        // Mutate random players
        nonCoAssign.forEach(idx => {
            if (Math.random() < mutationRate) {
                mutated[idx] = Math.floor(Math.random() * this.numTeams);
            }
        });

        // Occasionally mutate entire co-assign group
        const groupIds = Object.keys(this.coAssignGroups);
        if (groupIds.length > 0 && Math.random() < 0.1) {
            const groupId = groupIds[Math.floor(Math.random() * groupIds.length)];
            const newTeam = Math.floor(Math.random() * this.numTeams);
            this.coAssignGroups[groupId].forEach(idx => {
                mutated[idx] = newTeam;
            });
        }

        // Repair the individual to ensure constraints
        this.repairIndividual(mutated);

        return mutated;
    }

    repairIndividual(individual) {
        /**
         * Repair an individual to satisfy hard constraints:
         * 1. Team sizes within 1 player of each other
         * 2. All required positions covered on each team
         */
        const targetSize = Math.floor(this.numPlayers / this.numTeams);
        const maxIterations = 100;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            const teams = this.decodeIndividual(individual);
            const teamSizes = teams.map(t => t.players.length);
            const minSize = Math.min(...teamSizes);
            const maxSize = Math.max(...teamSizes);

            // Always balance team sizes first
            if (maxSize - minSize > 1) {
                this.balanceTeamSizes(individual, teams, teamSizes, targetSize);
                continue;
            }

            // Team sizes are balanced, now check positions
            if (this.checkPositionsCovered(teams)) {
                return; // All constraints satisfied!
            }

            // Positions not covered - try to fix
            const fixed = this.repairPositions(individual, teams);
            if (!fixed) {
                // Couldn't fix positions, might need to break team balance temporarily
                break;
            }
        }
    }

    balanceTeamSizes(individual, teams, teamSizes, targetSize) {
        const maxSize = Math.max(...teamSizes);
        const minSize = Math.min(...teamSizes);

        if (maxSize - minSize > 1) {
            const maxTeamId = teamSizes.indexOf(maxSize);
            const minTeamId = teamSizes.indexOf(minSize);
            this.movePlayer(individual, teams, maxTeamId, minTeamId);
        }
    }

    movePlayer(individual, teams, fromTeamId, toTeamId) {
        // Get players in the from_team
        const fromTeamPlayerIndices = [];
        for (let i = 0; i < individual.length; i++) {
            if (individual[i] === fromTeamId) {
                fromTeamPlayerIndices.push(i);
            }
        }

        // Prefer non-co-assigned players
        const nonCoAssignPlayers = fromTeamPlayerIndices.filter(i =>
            !Object.values(this.coAssignGroups).some(group => group.includes(i))
        );

        if (nonCoAssignPlayers.length > 0) {
            // Move a random non-co-assigned player
            const playerIdx = nonCoAssignPlayers[Math.floor(Math.random() * nonCoAssignPlayers.length)];
            individual[playerIdx] = toTeamId;
        } else if (fromTeamPlayerIndices.length > 0) {
            // Move a random player (even if co-assigned)
            const playerIdx = fromTeamPlayerIndices[Math.floor(Math.random() * fromTeamPlayerIndices.length)];

            // If co-assigned, move the whole group
            for (const [groupId, groupMembers] of Object.entries(this.coAssignGroups)) {
                if (groupMembers.includes(playerIdx)) {
                    groupMembers.forEach(idx => {
                        individual[idx] = toTeamId;
                    });
                    return;
                }
            }

            individual[playerIdx] = toTeamId;
        }
    }

    checkPositionsCovered(teams) {
        const requiredPositions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C'];

        for (const team of teams) {
            for (const pos of requiredPositions) {
                if (team.getPositionCount(pos) < 1) {
                    return false;
                }
            }

            // Check OF requirement
            if (team.getPositionCount('OF') < 3) {
                return false;
            }

        }

        return true;
    }

    repairPositions(individual, teams) {
        const requiredPositions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C'];

        for (let teamId = 0; teamId < teams.length; teamId++) {
            const team = teams[teamId];

            for (const pos of requiredPositions) {
                if (team.getPositionCount(pos) < 1) {
                    if (this.fixMissingPosition(individual, teams, teamId, pos)) {
                        return true;
                    }
                }
            }

            // Check OF requirement
            if (team.getPositionCount('OF') < 3) {
                if (this.fixMissingPosition(individual, teams, teamId, 'OF')) {
                    return true;
                }
            }

        }

        return false;
    }

    fixMissingPosition(individual, teams, needyTeamId, neededPos) {
        // First try: Look for teams that have extras of this position
        for (let teamId = 0; teamId < teams.length; teamId++) {
            if (teamId === needyTeamId) continue;

            const team = teams[teamId];

            if (neededPos === 'OF') {
                if (team.getPositionCount('OF') > 3) {
                    if (this.swapPositionPlayer(individual, teams, teamId, needyTeamId, neededPos)) {
                        return true;
                    }
                }
            } else {
                if (team.getPositionCount(neededPos) > 1) {
                    if (this.swapPositionPlayer(individual, teams, teamId, needyTeamId, neededPos)) {
                        return true;
                    }
                }
            }
        }

        // Second try: FORCEFULLY take a player from any team that has this position
        for (let teamId = 0; teamId < teams.length; teamId++) {
            if (teamId === needyTeamId) continue;

            const team = teams[teamId];

            if (neededPos === 'OF') {
                if (team.getPositionCount('OF') > 2) {
                    if (this.swapPositionPlayer(individual, teams, teamId, needyTeamId, neededPos)) {
                        return true;
                    }
                }
            } else {
                if (team.getPositionCount(neededPos) > 0) {
                    if (this.swapPositionPlayer(individual, teams, teamId, needyTeamId, neededPos)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    swapPositionPlayer(individual, teams, donorTeamId, recipientTeamId, position) {
        // Find players with this position in donor team (prefer non-co-assigned)
        const donorPlayers = [];

        for (let i = 0; i < individual.length; i++) {
            if (individual[i] !== donorTeamId) continue;

            const player = this.players[i];
            let isMatch = false;

            if (position === 'OF' && player.isOutfielder()) {
                isMatch = true;
            } else if (player.position === position) {
                isMatch = true;
            }

            if (isMatch) {
                const isCoAssigned = Object.values(this.coAssignGroups).some(group => group.includes(i));
                if (!isCoAssigned) {
                    donorPlayers.push(i);
                }
            }
        }

        if (donorPlayers.length > 0) {
            const playerIdx = donorPlayers[Math.floor(Math.random() * donorPlayers.length)];
            individual[playerIdx] = recipientTeamId;
            return true;
        }

        return false;
    }

    tournamentSelection(population, fitnesses, tournamentSize = 3) {
        const competitors = [];
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * population.length);
            competitors.push({ individual: population[idx], fitness: fitnesses[idx] });
        }
        competitors.sort((a, b) => a.fitness - b.fitness);
        return [...competitors[0].individual];
    }

    async optimize() {
        // Helper to yield to the event loop
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        // Create initial population
        let population = Array.from({ length: this.populationSize }, () => this.createIndividual());

        let bestIndividual = null;
        let bestFitness = Infinity;

        for (let gen = 0; gen < this.generations; gen++) {
            // Evaluate population
            const fitnesses = population.map(ind => this.evaluate(ind));

            // Track best
            const minFitness = Math.min(...fitnesses);
            const minIdx = fitnesses.indexOf(minFitness);
            if (minFitness < bestFitness) {
                bestFitness = minFitness;
                bestIndividual = [...population[minIdx]];
            }

            // Report progress more frequently
            if (this.onProgress && gen % 10 === 0) {
                const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
                this.onProgress({
                    generation: gen,
                    bestFitness: bestFitness,
                    avgFitness: avgFitness
                });
                
                // Yield to the event loop every 10 generations to keep UI responsive
                await sleep(0);
            }

            // Create next generation
            const newPopulation = [];

            // Elitism - keep best individual
            newPopulation.push([...bestIndividual]);

            // Generate rest of population
            while (newPopulation.length < this.populationSize) {
                // Selection
                const parent1 = this.tournamentSelection(population, fitnesses);
                const parent2 = this.tournamentSelection(population, fitnesses);

                // Crossover
                let [offspring1, offspring2] = this.crossover(parent1, parent2);

                // Mutation
                offspring1 = this.mutate(offspring1);
                offspring2 = this.mutate(offspring2);

                newPopulation.push(offspring1);
                if (newPopulation.length < this.populationSize) {
                    newPopulation.push(offspring2);
                }
            }

            population = newPopulation;
        }

        // Final report
        if (this.onProgress) {
            this.onProgress({
                generation: this.generations,
                bestFitness: bestFitness,
                avgFitness: bestFitness,
                completed: true
            });
        }

        return this.decodeIndividual(bestIndividual);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Player, Team, TeamOptimizer };
}

