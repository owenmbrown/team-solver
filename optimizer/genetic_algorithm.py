"""Genetic algorithm for team optimization."""
import random
import numpy as np
from typing import List, Tuple
from deap import base, creator, tools, algorithms
from optimizer.models import Player, Team


class TeamOptimizer:
    """Genetic algorithm-based team optimizer."""
    
    def __init__(self, players: List[Player], num_teams: int, population_size=300, generations=500):
        """
        Initialize the optimizer.
        
        Args:
            players: List of all players
            num_teams: Number of teams to create
            population_size: Size of GA population
            generations: Number of generations to run
        """
        self.players = players
        self.num_teams = num_teams
        self.population_size = population_size
        self.generations = generations
        self.num_players = len(players)
        
        # Group players by co-assign groups
        self.co_assign_groups = self._build_co_assign_groups()
        
        # Setup DEAP
        self._setup_deap()
    
    def _build_co_assign_groups(self) -> dict:
        """Build a dictionary of co-assign groups."""
        groups = {}
        for i, player in enumerate(self.players):
            if player.co_assign_group is not None:
                if player.co_assign_group not in groups:
                    groups[player.co_assign_group] = []
                groups[player.co_assign_group].append(i)
        return groups
    
    def _setup_deap(self):
        """Setup DEAP framework for genetic algorithm."""
        # Create fitness and individual classes
        if hasattr(creator, "FitnessMin"):
            del creator.FitnessMin
        if hasattr(creator, "Individual"):
            del creator.Individual
            
        creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
        creator.create("Individual", list, fitness=creator.FitnessMin)
        
        self.toolbox = base.Toolbox()
        
        # Register genetic operators
        self.toolbox.register("individual", self._create_individual)
        self.toolbox.register("population", tools.initRepeat, list, self.toolbox.individual)
        self.toolbox.register("evaluate", self._evaluate)
        self.toolbox.register("mate", self._crossover)
        self.toolbox.register("mutate", self._mutate)
        self.toolbox.register("select", tools.selTournament, tournsize=3)
    
    def _create_individual(self):
        """Create a random individual (team assignment)."""
        # Individual is a list where index is player index, value is team number
        individual = [0] * self.num_players
        
        # Assign players to teams randomly, respecting co-assign groups
        assigned = [False] * self.num_players
        
        for group_id, player_indices in self.co_assign_groups.items():
            # All players in a group go to the same team
            team = random.randint(0, self.num_teams - 1)
            for idx in player_indices:
                individual[idx] = team
                assigned[idx] = True
        
        # Assign remaining players
        for i in range(self.num_players):
            if not assigned[i]:
                individual[i] = random.randint(0, self.num_teams - 1)
        
        return creator.Individual(individual)
    
    def _decode_individual(self, individual: List[int]) -> List[Team]:
        """Convert an individual (list of team assignments) to Team objects."""
        teams = [Team(team_id=i, players=[]) for i in range(self.num_teams)]
        
        for player_idx, team_id in enumerate(individual):
            teams[team_id].add_player(self.players[player_idx])
        
        return teams
    
    def _repair_individual(self, individual: List[int]):
        """
        Repair an individual to satisfy hard constraints:
        1. Team sizes within 1 player of each other
        2. All required positions covered on each team
        
        This modifies individual in-place.
        """
        # Calculate target team size
        target_size = self.num_players // self.num_teams
        remainder = self.num_players % self.num_teams
        
        # Some teams get target_size, some get target_size+1
        # All should be within 1 of each other
        
        max_iterations = 100  # Allow more iterations for complex repairs
        for iteration in range(max_iterations):
            teams = self._decode_individual(individual)
            team_sizes = [len(team.players) for team in teams]
            min_size = min(team_sizes)
            max_size = max(team_sizes)
            
            # Always balance team sizes first
            if max_size - min_size > 1:
                self._balance_team_sizes(individual, teams, team_sizes, target_size)
                continue
            
            # Team sizes are balanced, now check positions
            if self._check_positions_covered(teams):
                return  # All constraints satisfied!
            
            # Positions not covered - try to fix
            fixed = self._repair_positions(individual, teams)
            if not fixed:
                # Couldn't fix positions with simple swaps, might need to break team balance temporarily
                # This will be fixed in next iteration
                break
    
    def _balance_team_sizes(self, individual, teams, team_sizes, target_size):
        """Move players from oversized teams to undersized teams."""
        max_size = max(team_sizes)
        min_size = min(team_sizes)
        
        # If difference is more than 1, move players
        if max_size - min_size > 1:
            # Find the team with max size and min size
            max_team_id = team_sizes.index(max_size)
            min_team_id = team_sizes.index(min_size)
            
            # Move a player from max to min
            self._move_player(individual, teams, max_team_id, min_team_id)
    
    def _move_player(self, individual, teams, from_team_id, to_team_id):
        """Move a player from one team to another (prefer non-co-assigned players)."""
        # Get players in the from_team
        from_team_player_indices = [i for i, team_id in enumerate(individual) if team_id == from_team_id]
        
        # Prefer non-co-assigned players
        non_coassign_players = [i for i in from_team_player_indices 
                               if not any(i in group for group in self.co_assign_groups.values())]
        
        if non_coassign_players:
            # Move a random non-co-assigned player
            player_idx = random.choice(non_coassign_players)
            individual[player_idx] = to_team_id
        elif from_team_player_indices:
            # Move a random player (even if co-assigned - this might break co-assign but size is critical)
            player_idx = random.choice(from_team_player_indices)
            # If co-assigned, move the whole group
            for group_id, group_members in self.co_assign_groups.items():
                if player_idx in group_members:
                    for idx in group_members:
                        individual[idx] = to_team_id
                    return
            individual[player_idx] = to_team_id
    
    def _check_positions_covered(self, teams) -> bool:
        """Check if all required positions are covered on all teams."""
        required_positions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C']
        
        for team in teams:
            for pos in required_positions:
                if team.get_position_count(pos) < 1:
                    return False
            
            # Check OF requirement
            if team.get_position_count('OF') < 3:
                return False
            
            # Check pitcher attendance rule
            pitchers = [p for p in team.players if p.position == 'P']
            if pitchers:
                has_perfect_attendance = any(p.attendance >= 1.0 for p in pitchers)
                if not has_perfect_attendance and len(pitchers) < 2:
                    return False
        
        return True
    
    def _repair_positions(self, individual, teams):
        """Try to fix position coverage by swapping players between teams."""
        required_positions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C']
        
        # Find teams with missing positions and fix them
        for team_id, team in enumerate(teams):
            for pos in required_positions:
                if team.get_position_count(pos) < 1:
                    # This team is missing this position
                    # Find a team with extras and swap or move
                    if self._fix_missing_position(individual, teams, team_id, pos):
                        return True  # Fixed something
            
            # Check OF requirement
            if team.get_position_count('OF') < 3:
                if self._fix_missing_position(individual, teams, team_id, 'OF'):
                    return True
            
            # Check pitcher attendance rule
            pitchers = [p for p in team.players if p.position == 'P']
            if pitchers:
                has_perfect_attendance = any(p.attendance >= 1.0 for p in pitchers)
                if not has_perfect_attendance and len(pitchers) < 2:
                    # Need a second pitcher
                    if self._fix_missing_position(individual, teams, team_id, 'P'):
                        return True
        
        return False  # Couldn't fix anything
    
    def _fix_missing_position(self, individual, teams, needy_team_id, needed_pos):
        """Try to get a player with needed_pos to needy_team. Returns True if fixed."""
        # First try: Look for teams that have extras of this position
        for team_id, team in enumerate(teams):
            if team_id == needy_team_id:
                continue
            
            # Does this team have extra players of this position?
            if needed_pos == 'OF':
                if team.get_position_count('OF') > 3:
                    # Try to swap an OF player
                    if self._swap_position_player(individual, teams, team_id, needy_team_id, needed_pos):
                        return True
            else:
                if team.get_position_count(needed_pos) > 1:
                    # Try to swap this position player
                    if self._swap_position_player(individual, teams, team_id, needy_team_id, needed_pos):
                        return True
        
        # Second try: FORCEFULLY take a player from any team that has this position
        # This is necessary when no team has "extras" but we still need to satisfy constraints
        for team_id, team in enumerate(teams):
            if team_id == needy_team_id:
                continue
            
            if needed_pos == 'OF':
                if team.get_position_count('OF') > 2:  # Leave them with at least 2 (we'll fix later)
                    if self._swap_position_player(individual, teams, team_id, needy_team_id, needed_pos):
                        return True
            else:
                if team.get_position_count(needed_pos) > 0:  # Take even if they only have 1
                    if self._swap_position_player(individual, teams, team_id, needy_team_id, needed_pos):
                        return True
        
        return False
    
    def _swap_position_player(self, individual, teams, donor_team_id, recipient_team_id, position):
        """Swap a player of the given position from donor to recipient. Returns True if successful."""
        # Find players with this position in donor team (prefer non-co-assigned)
        donor_players = []
        for i, team_id in enumerate(individual):
            if team_id == donor_team_id:
                player = self.players[i]
                is_match = False
                
                if position == 'OF' and player.is_outfielder():
                    is_match = True
                elif player.position == position:
                    is_match = True
                
                if is_match:
                    # Prefer non-co-assigned players for easier swapping
                    is_coassigned = any(i in group for group in self.co_assign_groups.values())
                    if not is_coassigned:
                        donor_players.append(i)
        
        if donor_players:
            # Pick one to move
            player_idx = random.choice(donor_players)
            individual[player_idx] = recipient_team_id
            return True
        
        return False
    
    def _evaluate(self, individual: List[int]) -> Tuple[float,]:
        """
        Evaluate fitness of an individual.
        
        Lower is better. Fitness includes:
        - Constraint violations (heavily penalized)
        - Team size balance (all teams within 1 player of each other)
        - Variance in average skill across teams
        - Variance in average attendance across teams
        - Average within-team skill variance
        """
        teams = self._decode_individual(individual)
        
        penalty = 0.0
        
        # Check position constraints (HIGHEST priority - these are absolute requirements)
        required_positions = ['SS', 'CF', '2B', '3B', 'P', '1B', 'C']
        for team in teams:
            # Each team needs at least one of each required position
            for pos in required_positions:
                count = team.get_position_count(pos)
                if count < 1:
                    penalty += 10000.0  # CRITICAL penalty for missing position
            
            # Special pitcher rule: need 2 pitchers unless we have 1 with perfect attendance
            pitchers = [p for p in team.players if p.position == 'P']
            if len(pitchers) > 0:
                # Check if any pitcher has perfect attendance (1.0)
                has_perfect_attendance_pitcher = any(p.attendance >= 1.0 for p in pitchers)
                if not has_perfect_attendance_pitcher and len(pitchers) < 2:
                    penalty += 10000.0  # CRITICAL penalty - need 2 pitchers if none have perfect attendance
            
            # Need at least 2 additional OF (total OF should be >= 3, including CF)
            total_of = team.get_position_count('OF')
            if total_of < 3:
                penalty += 5000.0 * (3 - total_of)
            
            # Minimum team size check (should have at least 9 players for all positions)
            if len(team.players) < 9:
                penalty += 2000.0 * (9 - len(team.players))
        
        # Check co-assign constraint (should be satisfied by construction, but verify)
        for group_id, player_indices in self.co_assign_groups.items():
            teams_for_group = set(individual[idx] for idx in player_indices)
            if len(teams_for_group) > 1:
                penalty += 500.0  # Huge penalty for splitting co-assign groups
        
        # Check team size balance - all teams must be within 1 player of each other
        team_sizes = [len(team.players) for team in teams]
        min_size = min(team_sizes)
        max_size = max(team_sizes)
        if max_size - min_size > 1:
            # Massive penalty for size imbalance (higher priority than skill balance)
            penalty += 3000.0 * (max_size - min_size - 1)
        
        # Calculate skill balance across teams
        avg_skills = [team.get_average_skill() for team in teams]
        skill_variance = np.var(avg_skills) if len(avg_skills) > 1 else 0.0
        
        # Calculate attendance balance across teams
        avg_attendances = [team.get_average_attendance() for team in teams]
        attendance_variance = np.var(avg_attendances) if len(avg_attendances) > 1 else 0.0
        
        # Calculate average within-team skill variance
        within_team_variances = [team.get_skill_variance() for team in teams]
        avg_within_variance = np.mean(within_team_variances)
        
        # Coach distribution - spread coaches as evenly as possible across teams
        total_coaches = sum(1 for p in self.players if p.is_coach)
        coach_penalty = 0.0
        
        if total_coaches > 0:
            # Count coaches per team
            coaches_per_team = [sum(1 for p in team.players if p.is_coach) for team in teams]
            
            if total_coaches >= self.num_teams:
                # We have enough coaches for all teams - each team should have exactly 1
                for count in coaches_per_team:
                    if count == 0:
                        coach_penalty += 50.0  # Heavy penalty for team without coach
                    elif count > 1:
                        coach_penalty += 30.0 * (count - 1)  # Penalty for multiple coaches
            else:
                # Fewer coaches than teams - but still spread them out
                # No team should have more than 1 coach
                for count in coaches_per_team:
                    if count > 1:
                        coach_penalty += 50.0 * (count - 1)  # Heavy penalty for multiple coaches
        
        # Combine fitness components
        # Prioritize skill balance (want difference < 1.0) but not at the expense of hard constraints
        fitness = (
            penalty +
            skill_variance * 50.0 +  # Increased from 2.0 to 50.0 for tighter skill balance
            attendance_variance * 10.0 +  # Reduced from 100.0 to 10.0
            avg_within_variance * 0.5 +
            coach_penalty
        )
        
        return (fitness,)
    
    def _crossover(self, ind1, ind2):
        """
        Perform crossover while respecting co-assign constraints.
        Then repair both offspring to ensure constraints.
        """
        size = len(ind1)
        
        # Two-point crossover, but respect co-assign groups
        if random.random() < 0.7:  # 70% crossover rate
            # Get non-co-assigned player indices
            non_coassign = [i for i in range(size) 
                           if not any(i in group for group in self.co_assign_groups.values())]
            
            if len(non_coassign) > 2:
                # Perform crossover on non-co-assigned players
                cx_point1 = random.randint(0, len(non_coassign) - 1)
                cx_point2 = random.randint(cx_point1, len(non_coassign) - 1)
                
                for i in range(cx_point1, cx_point2):
                    idx = non_coassign[i]
                    ind1[idx], ind2[idx] = ind2[idx], ind1[idx]
        
        # Repair both offspring to satisfy hard constraints
        self._repair_individual(ind1)
        self._repair_individual(ind2)
        
        return ind1, ind2
    
    def _mutate(self, individual):
        """
        Mutate an individual while respecting co-assign constraints.
        Then repair to ensure team size and position constraints.
        """
        # Get non-co-assigned player indices
        non_coassign = [i for i in range(len(individual)) 
                       if not any(i in group for group in self.co_assign_groups.values())]
        
        # Mutate a few random players
        mutation_rate = 0.1
        for idx in non_coassign:
            if random.random() < mutation_rate:
                individual[idx] = random.randint(0, self.num_teams - 1)
        
        # Occasionally mutate an entire co-assign group
        if self.co_assign_groups and random.random() < 0.1:
            group_id = random.choice(list(self.co_assign_groups.keys()))
            new_team = random.randint(0, self.num_teams - 1)
            for idx in self.co_assign_groups[group_id]:
                individual[idx] = new_team
        
        # Repair the individual to satisfy hard constraints
        self._repair_individual(individual)
        
        return individual,
    
    def optimize(self, verbose=True) -> List[Team]:
        """
        Run the genetic algorithm to find optimal team assignments.
        
        Args:
            verbose: Whether to print progress
            
        Returns:
            List of optimized Team objects
        """
        # Create initial population
        population = self.toolbox.population(n=self.population_size)
        
        # Statistics
        stats = tools.Statistics(lambda ind: ind.fitness.values)
        stats.register("avg", np.mean)
        stats.register("min", np.min)
        stats.register("max", np.max)
        
        # Hall of fame to keep best individuals
        hof = tools.HallOfFame(1)
        
        # Run genetic algorithm
        if verbose:
            print(f"Starting optimization with {self.num_players} players into {self.num_teams} teams...")
            print(f"Population: {self.population_size}, Generations: {self.generations}")
        
        population, logbook = algorithms.eaSimple(
            population, self.toolbox,
            cxpb=0.7,  # Crossover probability
            mutpb=0.2,  # Mutation probability
            ngen=self.generations,
            stats=stats,
            halloffame=hof,
            verbose=verbose
        )
        
        # Get best individual
        best_individual = hof[0]
        best_teams = self._decode_individual(best_individual)
        
        if verbose:
            print(f"\nOptimization complete! Best fitness: {best_individual.fitness.values[0]:.4f}")
        
        return best_teams

