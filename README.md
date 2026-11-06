# Hill Climbing Lab

A dependency-free, browser-based visualizer for N-Queens and two-variable function landscapes. Open `dist/index.html` through any static web server. ES modules require HTTP; opening the file directly with `file://` is not supported.

## Run locally

Extract the complete ZIP first. You need **Python 3.8 or newer** and a modern browser. No npm installation, API keys, build step, or ChatGPT sign-in is required. Once Python is installed, the visualizer works offline.

### Windows

Open the extracted `Hill_Climbing_Lab` folder and double-click **START_WINDOWS.bat**. Keep the console window open while using the app. The launcher opens the visualizer in your default browser. If the browser does not open, copy the address printed in the console.

Alternatively, open a terminal in that folder and run:

```bat
py -3 run_local.py
```

If Windows does not recognize `py`, try `python run_local.py`. Install Python first if neither command is available.

### macOS / Linux

Open a terminal in the extracted `Hill_Climbing_Lab` folder and run:

```sh
python3 run_local.py
```

You can also use `bash start-mac-linux.sh`.

The default address is **http://127.0.0.1:8080/**. If port 8080 is busy, the launcher selects a free port and prints the actual address. Press **Ctrl+C** in the terminal to stop the app. The server is accessible only on your own computer.

Optional launcher arguments:

```sh
python3 run_local.py --port 9090
python3 run_local.py --no-browser
```

If you prefer an existing static web server, serve the `dist` directory:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Use the HTTP address; opening `dist/index.html` directly with a double-click will not load ES modules. All styles, graphics, scripts, and algorithm data are included. The app does not send user input to an external server.

## Included files

- `dist/`: complete visualizer source (HTML, CSS, and JavaScript).
- `run_local.py`: local server and browser launcher.
- `START_WINDOWS.bat`: Windows launcher.
- `start-mac-linux.sh`: macOS/Linux launcher.
- `tests/`: algorithm tests.
- `package.json`: optional Node.js test command; Node.js is not required to use the visualizer.

## What to try

- N-Queens: choose **One move from a solution**, then **Step**.
- Choose **Local minimum**, then **Step** twice to see the stuck state followed by a random restart.
- Choose **Plateau example** with sideways moves enabled to explore equal-cost neighbors. Disable sideways moves and step to see the plateau stop condition.
- Switch to **Function landscape**. Toggle between 2D contours and a rotatable 3D surface. Click the 2D view to set a start; the point snaps to the selected step grid.
- Compare **Smooth bowl**, **Peaks & valleys**, **Terraced plateau**, and **Rastrigin**. Change the step size to inspect how the sampled neighborhood changes.
- Pause and drag the recorded-state slider to review the board/surface, score, counters and trace at that point. Run resumes from the latest search state. Step advances through recorded states while reviewing.

## Algorithm

Hill climbing minimizes cost, equivalently maximizing fitness = −cost. Queens use one queen per column and N(N−1) neighbors. Each unordered attacking pair contributes one to the objective. The algorithm evaluates every neighbor and picks a minimum-cost neighbor, breaking ties with seeded randomness. Improvements reset the sideways streak. Equal-cost moves require the sideways option and remaining consecutive-move budget.

A strictly worse best neighbor indicates a strict local minimum; an equal neighbor that cannot be taken indicates a plateau stop. The stuck state is recorded separately; an allowed random restart occurs on the next step. Restarts retain the best-ever state, reset the sideways streak, and count against the restart budget. The overall run is capped at 3,000 accepted moves.

Landscapes sample up to eight directions in the bounded square [−3, 3]². A sampled neighborhood minimum is not proof of a continuous or global minimum. Known global minima are checked only for the bowl, terraces and Rastrigin. Peaks & valleys makes no global-optimality claim. Surface rendering and contour rendering use the same objective functions as search.

The seed, settings, and initial state reproduce tie choices and random restarts. Presets have fixed starting states. Animation speed and rendering options do not change the search. All recorded states remain available during a run; the trace displays the latest 60 events up to the selected state.

## Verification

```sh
npm test
```

Pure engine tests cover pair counting, neighbor completeness, reproducibility, greedy choices, sideways limits, local minima, restart budgets, solutions and finite-step landscape behavior. Rendered interaction is checked separately in a browser.
