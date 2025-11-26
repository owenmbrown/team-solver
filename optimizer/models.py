"""Data models for players and teams."""
from dataclasses import dataclass
from typing import Optional, List


@dataclass
class Player:
    """Represents a softball player with their stats and attributes."""
    name: str
    position: str  # SS, CF, OF, 2B, 3B, P, 1B, C
    batting_average: int
    slugging: int
    offensive_total: int
    efficiency: int
    range: int
    defensive_total: int
    base_running: int
    total_score: int
    attendance: float
    total_with_attendance: float
    is_coach: bool
    co_assign_group: Optional[int]  # ID for car-pool groups
    
    def __repr__(self):
        coach_str = " (Coach)" if self.is_coach else ""
        co_assign_str = f" [Group {self.co_assign_group}]" if self.co_assign_group else ""
        return f"{self.name} ({self.position}){coach_str}{co_assign_str} - Total: {self.total_score:.1f}, Att: {self.attendance:.1%}"
    
    def is_outfielder(self) -> bool:
        """Check if player can play outfield positions."""
        return self.position in ['CF', 'OF']
    
    def can_play_position(self, pos: str) -> bool:
        """Check if player can play a specific position."""
        if pos == 'OF' and self.is_outfielder():
            return True
        return self.position == pos


@dataclass
class Team:
    """Represents a team with assigned players."""
    team_id: int
    players: List[Player]
    
    def __post_init__(self):
        if self.players is None:
            self.players = []
    
    def add_player(self, player: Player):
        """Add a player to the team."""
        self.players.append(player)
    
    def remove_player(self, player: Player):
        """Remove a player from the team."""
        self.players.remove(player)
    
    def get_average_skill(self) -> float:
        """Calculate average skill rating (total score)."""
        if not self.players:
            return 0.0
        return sum(p.total_score for p in self.players) / len(self.players)
    
    def get_average_attendance(self) -> float:
        """Calculate average attendance."""
        if not self.players:
            return 0.0
        return sum(p.attendance for p in self.players) / len(self.players)
    
    def get_skill_variance(self) -> float:
        """Calculate variance in skill ratings within the team."""
        if len(self.players) < 2:
            return 0.0
        avg = self.get_average_skill()
        variance = sum((p.total_score - avg) ** 2 for p in self.players) / len(self.players)
        return variance
    
    def get_position_count(self, position: str) -> int:
        """Count how many players can play a specific position."""
        if position == 'OF':
            return sum(1 for p in self.players if p.is_outfielder())
        return sum(1 for p in self.players if p.position == position)
    
    def has_coach(self) -> bool:
        """Check if team has a coach."""
        return any(p.is_coach for p in self.players)
    
    def get_position_coverage(self) -> dict:
        """Get count of players for each required position."""
        return {
            'SS': self.get_position_count('SS'),
            'CF': self.get_position_count('CF'),
            '2B': self.get_position_count('2B'),
            '3B': self.get_position_count('3B'),
            'P': self.get_position_count('P'),
            '1B': self.get_position_count('1B'),
            'C': self.get_position_count('C'),
            'OF': self.get_position_count('OF'),
        }
    
    def __repr__(self):
        return f"Team {self.team_id}: {len(self.players)} players, Avg Skill: {self.get_average_skill():.2f}, Avg Att: {self.get_average_attendance():.1%}"

