# ⚾ Softball Team Optimizer

An AI-powered team balancing tool that uses genetic algorithms to create optimally balanced softball teams. Balances teams based on skill ratings, attendance, and position requirements while respecting coaching assignments and car-pool groups.

## 🌟 Features

- **Genetic Algorithm Optimization**: Uses evolutionary algorithms for optimal team balancing
- **Multi-Constraint Support**:
  - Position requirements (SS, CF, 2B, 3B, P, 1B, C, OF)
  - Coach distribution across teams
  - Car-pool group assignments
  - Skill and attendance balance
  - Minimized within-team variance
- **Dual Interface**:
  - Command-line tool for quick optimization
  - Beautiful web interface hosted on GitHub Pages
- **Export Results**: Download team assignments in JSON format

## 🚀 Quick Start

### Web Interface (Recommended)

Visit the live web app: **[GitHub Pages URL will be here after deployment]**

1. Upload your player data file (**CSV or Excel** - .csv, .xlsx, .xls)
2. Select the number of teams
3. Click "Optimize Teams"
4. View and export results

### Command-Line Interface

#### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/team-solver.git
cd team-solver

# Install uv (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies and create virtual environment
uv sync
```

#### Usage

```bash
# Basic usage
uv run python optimize_teams.py "Softball team build.csv" 4

# With custom parameters
uv run python optimize_teams.py "Softball team build.csv" 5 --generations 1000 --output results.json

# All options
uv run python optimize_teams.py --help
```

#### Options

- `csv_file`: Path to your player data CSV file (required)
- `num_teams`: Number of teams to create (required)
- `--population`: Population size for genetic algorithm (default: 300)
- `--generations`: Number of generations to run (default: 500)
- `--output`: Export results to JSON file (optional)
- `--quiet`: Suppress progress output (optional)

## 📊 Data Format

Your data file (CSV or Excel) should have the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| Player | Player name | Yes |
| Pos | Position (SS, CF, 2B, 3B, P, 1B, C, OF) | Yes |
| BA | Batting Average rating | No |
| SLG | Slugging rating | No |
| Tot | Offensive total | No |
| Eff | Efficiency rating | No |
| Range | Range rating | No |
| Def.1 | Defensive total | No |
| BR | Base running rating | No |
| Total | Total skill score | Yes |
| Attend | Attendance rate (0.0-1.0) | Yes |
| Total w/Att | Adjusted total with attendance | No |
| Coach | 'Y' if player is a coach | No |
| Co-assign | Car-pool group ID number | No |

See `Softball team build.csv` for an example.

**Note**: The web interface accepts both CSV and Excel formats (.csv, .xlsx, .xls). The CLI requires CSV format.

## 🏗️ Project Structure

```
team-solver/
├── optimizer/              # Python optimization engine
│   ├── __init__.py
│   ├── models.py          # Data models (Player, Team)
│   ├── parser.py          # CSV parser
│   ├── genetic_algorithm.py  # GA implementation
│   └── cli.py             # Command-line interface
├── web/                   # Web interface
│   ├── index.html         # Main page
│   ├── styles.css         # Styling
│   ├── app.js             # UI logic
│   ├── optimizer.js       # JS port of optimizer
│   └── parser.js          # CSV parser for web
├── optimize_teams.py      # Main CLI entry point
├── requirements.txt       # Python dependencies
└── README.md
```

## 🧬 How It Works

The optimizer uses a **constraint-preserving genetic algorithm** to find optimal team assignments:

1. **Initial Population**: Creates random team assignments respecting car-pool constraints
2. **Constraint-Preserving Operators**: After each crossover or mutation:
   - **Automatic Repair**: Invalid solutions are immediately repaired to satisfy all hard constraints
   - **Team Size Balancing**: Moves players between teams to ensure sizes differ by at most 1
   - **Position Coverage**: Swaps players to ensure each team has all required positions
   - **Result**: Only valid solutions are ever evaluated, massively improving efficiency
3. **Fitness Evaluation**: Scores each solution based on:
   - Skill balance across teams (heavily weighted to achieve <1.0 difference)
   - Attendance balance across teams
   - Within-team skill variance (avoid mixing very high/low skill players)
4. **Evolution**: Uses tournament selection to create next generation
5. **Convergence**: Runs for specified generations to find optimal assignment

This approach ensures **hard constraints are never violated** (team sizes, positions, car-pools), allowing the algorithm to focus on **optimizing soft goals** (skill balance, attendance balance).

### Constraints

- Each team must have at least:
  - 1 Shortstop (SS)
  - 1 Center Fielder (CF)
  - 1 Second Baseman (2B)
  - 1 Third Baseman (3B)
  - 1 Pitcher (P)
  - 1 First Baseman (1B)
  - 1 Catcher (C)
  - 2 additional Outfielders (total 3 OF including CF)

- **All team sizes must be within 1 player of each other** (e.g., 13-14 or 10-11 players per team)
- **Coaches are spread as evenly as possible**: When there are enough coaches for all teams, each team gets exactly 1 coach. When there are fewer coaches than teams, no team should have multiple coaches.
- Players in the same car-pool group are always assigned together

## 🎯 Optimization Goals

**Hard Constraints** (structurally enforced, never violated):
1. All required positions filled on each team (including 1 pitcher minimum)
2. Team sizes within 1 player of each other
3. Car-pool groups kept together

**Soft Goals** (optimized via fitness function):
1. **Skill balance** (highest priority): Teams should have similar average skill levels (< 1.0 difference)
2. **Within-team variance**: Each team should have balanced skill distribution (not all stars or all beginners)
3. **Attendance balance** (lower priority): Teams should have similar attendance rates
4. **Coach distribution**: Spread coaches evenly when possible

## 🛠️ Development

### Python CLI

```bash
# Install development dependencies
pip install -r requirements.txt

# Run optimizer
python optimize_teams.py "Softball team build.csv" 4
```

### Web Interface

The web interface runs entirely client-side (no server needed):

```bash
# Serve locally for testing
cd web
python -m http.server 8000

# Visit http://localhost:8000
```

## 📦 Dependency Management

This project uses **uv** - a modern, extremely fast Python package manager.

- Installation: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Setup: `uv sync`
- Run: `uv run optimize-teams "data.csv" 4`

See [UV_GUIDE.md](UV_GUIDE.md) for detailed instructions.

**Still prefer pip?** Generate requirements.txt: `uv pip compile pyproject.toml -o requirements.txt`

## 📈 Performance Tips

- **More generations** = better results but slower (default: 500)
- **Larger population** = better diversity but slower (default: 300)
- For quick testing: `--generations 100`
- For best results: `--generations 1000 --population 500`

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📝 License

This project is open source and available for use in softball leagues and similar organizations.

## 🙏 Acknowledgments

Built with:
- Python & [DEAP](https://github.com/DEAP/deap) (genetic algorithms)
- Vanilla JavaScript (no frameworks - fast and simple!)
- Modern CSS (responsive design)

## 📧 Support

For questions or issues, please open a GitHub issue or contact the maintainer.

---

**Made with ⚾ for softball leagues everywhere**
