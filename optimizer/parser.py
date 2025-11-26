"""CSV parser for player data."""
import pandas as pd
from typing import List
from optimizer.models import Player


def parse_csv(file_path: str) -> List[Player]:
    """
    Parse the softball player CSV file and return a list of Player objects.
    
    Args:
        file_path: Path to the CSV file
        
    Returns:
        List of Player objects
    """
    # Skip the second header row (sub-categories)
    df = pd.read_csv(file_path, skiprows=[1])
    players = []
    
    for _, row in df.iterrows():
        # Skip the league average row
        if pd.isna(row['Player']) or row['Player'] == 'League Avg':
            continue
        
        # Parse co-assign group
        co_assign = None
        if pd.notna(row['Co-assign']):
            try:
                co_assign = int(row['Co-assign'])
            except (ValueError, TypeError):
                co_assign = None
        
        # Parse coach status
        is_coach = False
        if pd.notna(row['Coach']):
            is_coach = str(row['Coach']).strip().upper() == 'Y'
        
        # Handle missing values with defaults
        def safe_float(val, default=0.0):
            try:
                return float(val) if pd.notna(val) else default
            except (ValueError, TypeError):
                return default
        
        def safe_int(val, default=0):
            try:
                return int(val) if pd.notna(val) else default
            except (ValueError, TypeError):
                return default
        
        # The CSV columns after skipping row 1 are:
        # Player, Pos, Off(col2), Off(col3), Off(col4), Def(col5), Def(col6), Def(col7), BR, Total, Attend, Total w/Att, Coach, Co-assign
        # We'll use the actual column names from the first row
        
        player = Player(
            name=str(row['Player']).strip(),
            position=str(row['Pos']).strip(),
            batting_average=safe_int(row['Off']),  # First 'Off' column
            slugging=safe_int(row['Unnamed: 3']),  # Second unnamed column under Off
            offensive_total=safe_int(row['Unnamed: 4']),  # Third unnamed column under Off
            efficiency=safe_int(row['Def']),  # First 'Def' column
            range=safe_int(row['Unnamed: 6']),  # Second unnamed column under Def
            defensive_total=safe_int(row['Unnamed: 7']),  # Third unnamed column under Def
            base_running=safe_int(row['BR']),
            total_score=safe_float(row['Total']),
            attendance=safe_float(row['Attend'], 1.0),
            total_with_attendance=safe_float(row['Total w/Att']),
            is_coach=is_coach,
            co_assign_group=co_assign
        )
        players.append(player)
    
    return players


def get_league_average(file_path: str) -> dict:
    """
    Extract league average statistics from the CSV file.
    
    Args:
        file_path: Path to the CSV file
        
    Returns:
        Dictionary with league average stats
    """
    df = pd.read_csv(file_path)
    
    # Find the league average row
    league_row = df[df['Player'] == 'League Avg']
    
    if league_row.empty:
        return None
    
    row = league_row.iloc[0]
    
    return {
        'offensive_total': float(row['Tot']) if pd.notna(row['Tot']) else 0,
        'defensive_total': float(row['Def.1']) if pd.notna(row['Def.1']) else 0,
        'base_running': float(row['BR']) if pd.notna(row['BR']) else 0,
        'total_score': float(row['Total']) if pd.notna(row['Total']) else 0,
        'total_with_attendance': float(row['Total w/Att']) if pd.notna(row['Total w/Att']) else 0,
    }

