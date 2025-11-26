"""Command-line interface for the team optimizer."""
import argparse
import json
import sys
from pathlib import Path
from optimizer.parser import parse_csv, get_league_average
from optimizer.genetic_algorithm import TeamOptimizer


def print_team_summary(teams):
    """Print a summary of the teams."""
    print("\n" + "="*80)
    print("TEAM ASSIGNMENTS")
    print("="*80)
    
    for team in teams:
        print(f"\n{'='*80}")
        print(f"TEAM {team.team_id + 1}")
        print(f"{'='*80}")
        print(f"Players: {len(team.players)}")
        print(f"Average Skill: {team.get_average_skill():.2f}")
        print(f"Average Attendance: {team.get_average_attendance():.1%}")
        print(f"Skill Variance: {team.get_skill_variance():.2f}")
        print(f"Has Coach: {'Yes' if team.has_coach() else 'No'}")
        
        # Position coverage
        coverage = team.get_position_coverage()
        print(f"\nPosition Coverage:")
        for pos, count in coverage.items():
            status = "✓" if count >= 1 else "✗"
            print(f"  {pos}: {count} {status}")
        
        print(f"\nRoster:")
        # Sort players by position for easier reading
        sorted_players = sorted(team.players, key=lambda p: (p.position, -p.total_score))
        for player in sorted_players:
            co_assign_str = f" [Group {player.co_assign_group}]" if player.co_assign_group else ""
            coach_str = " (COACH)" if player.is_coach else ""
            print(f"  {player.name:30s} {player.position:3s} | "
                  f"Skill: {player.total_score:5.1f} | "
                  f"Att: {player.attendance:5.1%}{coach_str}{co_assign_str}")
    
    # Overall statistics
    print(f"\n{'='*80}")
    print("OVERALL STATISTICS")
    print(f"{'='*80}")
    
    avg_skills = [team.get_average_skill() for team in teams]
    avg_attendances = [team.get_average_attendance() for team in teams]
    
    print(f"\nSkill Balance:")
    print(f"  Min team average: {min(avg_skills):.2f}")
    print(f"  Max team average: {max(avg_skills):.2f}")
    print(f"  Difference: {max(avg_skills) - min(avg_skills):.2f}")
    
    print(f"\nAttendance Balance:")
    print(f"  Min team average: {min(avg_attendances):.1%}")
    print(f"  Max team average: {max(avg_attendances):.1%}")
    print(f"  Difference: {(max(avg_attendances) - min(avg_attendances)) * 100:.1f}%")
    
    print(f"\nTeam Sizes:")
    for team in teams:
        print(f"  Team {team.team_id + 1}: {len(team.players)} players")


def export_to_json(teams, output_file):
    """Export teams to JSON format."""
    data = {
        "teams": [
            {
                "team_id": team.team_id + 1,
                "players": [
                    {
                        "name": p.name,
                        "position": p.position,
                        "total_score": p.total_score,
                        "attendance": p.attendance,
                        "is_coach": p.is_coach,
                        "co_assign_group": p.co_assign_group
                    }
                    for p in team.players
                ],
                "avg_skill": team.get_average_skill(),
                "avg_attendance": team.get_average_attendance(),
                "skill_variance": team.get_skill_variance(),
                "position_coverage": team.get_position_coverage()
            }
            for team in teams
        ]
    }
    
    with open(output_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\nResults exported to {output_file}")


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Optimize softball team assignments using genetic algorithm"
    )
    parser.add_argument(
        "csv_file",
        type=str,
        help="Path to the CSV file containing player data"
    )
    parser.add_argument(
        "num_teams",
        type=int,
        help="Number of teams to create"
    )
    parser.add_argument(
        "--population",
        type=int,
        default=300,
        help="Population size for genetic algorithm (default: 300)"
    )
    parser.add_argument(
        "--generations",
        type=int,
        default=500,
        help="Number of generations to run (default: 500)"
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output JSON file path (optional)"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress progress output"
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    csv_path = Path(args.csv_file)
    if not csv_path.exists():
        print(f"Error: CSV file not found: {args.csv_file}", file=sys.stderr)
        sys.exit(1)
    
    if args.num_teams < 2:
        print("Error: Number of teams must be at least 2", file=sys.stderr)
        sys.exit(1)
    
    # Parse player data
    try:
        players = parse_csv(args.csv_file)
        print(f"Loaded {len(players)} players from {args.csv_file}")
    except Exception as e:
        print(f"Error parsing CSV file: {e}", file=sys.stderr)
        sys.exit(1)
    
    if len(players) < args.num_teams * 9:
        print(f"Warning: Only {len(players)} players for {args.num_teams} teams "
              f"(minimum {args.num_teams * 9} recommended for full rosters)")
    
    # Run optimizer
    optimizer = TeamOptimizer(
        players=players,
        num_teams=args.num_teams,
        population_size=args.population,
        generations=args.generations
    )
    
    teams = optimizer.optimize(verbose=not args.quiet)
    
    # Display results
    print_team_summary(teams)
    
    # Export if requested
    if args.output:
        export_to_json(teams, args.output)


if __name__ == "__main__":
    main()

