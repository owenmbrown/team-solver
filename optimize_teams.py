#!/usr/bin/env python3
"""
Softball Team Optimizer - Main entry point

Usage:
    python optimize_teams.py <csv_file> <num_teams> [options]

Example:
    python optimize_teams.py "Softball team build.csv" 4
    python optimize_teams.py "Softball team build.csv" 5 --generations 1000 --output results.json
"""

from optimizer.cli import main

if __name__ == "__main__":
    main()

