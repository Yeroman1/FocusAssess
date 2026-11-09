# FocusAssess: Robot Simulation (`cs1robots`) Instructor & Student Guide

This guide explains how instructors create and grade **Robot Simulation (`cs1robots`) Exam Items** on FocusAssess, and how students solve them.

---

## 1. What is `cs1robots` on FocusAssess?

`cs1robots` is an educational grid-world robot simulation module inspired by **KAIST CS101** and *Karel the Robot*. It provides an intuitive environment for assessing:
- Procedural decomposition and function abstraction.
- Control flow (`while`, `for`, `if`, `else`).
- Algorithmic navigation and obstacle avoidance.
- State machines and invariant handling.

FocusAssess runs a high-performance **headless implementation** of `cs1robots` inside an isolated sandbox kernel. It executes in **< 10ms with zero GUI/X11 dependencies**, preventing crashes while providing instant feedback.

---

## 2. Step-by-Step Instructor Workflow

### Step 1: Open the Exam Builder
1. Log in as an **Instructor** or **Administrator**.
2. Navigate to your exam and click **Edit / Build Exam**.
3. Click **"+ Add Question"**.
4. In the format selector grid, choose **`🤖 Robot Sim`** (cs1robots World).

### Step 2: Configure Problem Prompt & Target Photo
1. **Title**: Enter a clear title, e.g. `Lab 2: Hurdle Jump & Beeper Harvest`.
2. **Marks**: Allocate points (e.g. `20 pts`).
3. **Problem Statement**: Provide the narrative, rules, and starting assumptions.
4. **Target Output Photo**:
   - Click **"Upload Target Photo"** to upload a screenshot showing the expected final world, hurdle placements, and robot destination.
   - Candidates will see this target image rendered directly beside their code editor.

### Step 3: Define World & Starting Coordinates
Set the dimensions and initial robot configuration:
- **World Grid Size**: $Avenues$ (width) $\times$ $Streets$ (height), e.g. `10 × 10`.
- **Robot Starting Location**: `Avenue 1`, `Street 1`.
- **Starting Orientation**: `East (➔)`, `North (⬆)`, `West (⬅)`, or `South (⬇)`.
- **Initial Beepers in Bag**: e.g. `0`.

### Step 4: Configure Zero-Code Automated Grading Criteria
Instructors **do not write test scripts**. Simply fill in the target criteria:
- **Target Avenue & Street**: The destination coordinates where the robot must park (e.g. `10, 1`). Leave blank if any location is permitted.
- **Target Direction**: E.g. `East` or `Any Direction`.
- **Target Beepers**: The number of beepers that must be in the robot's bag upon completion.
- **Require Ground Cleared**: Checkbox to require that all beepers on the grid are picked up.
- **Wall Collision Protection**: Enabled automatically—any crash into a wall or world boundary immediately fails with 0 marks and descriptive feedback.

### Step 5: Test-Run Model Solution Live
Before publishing, instructors can test their solution right inside the form:
1. Paste a model solution in the **"Simulator Sandbox"** code area.
2. Click **"Test Simulation"**.
3. Within ~250ms, a live diagnostic badge confirms:
   - `✓ [ROBOT_SIMULATION_PASSED] Successfully reached (10, 1) facing E with 0 beeper(s) in 9 steps.`
   - Or gives exact collision/mismatch diagnostics if the test fails.

### Step 6: Save
Click **"Save Robot Question"**. FocusAssess automatically packages:
- Complete markdown problem prompt with formatted specifications.
- Target photo attachment.
- Automated evaluation test cases.

---

## 3. Student Experience & Conventions

When candidates open a Robot Simulation question during an active exam:
1. **Split-Screen Workspace**:
   - The left pane displays the instructions, rules, and the **Target Output Goal Photo**.
   - The problem header features the `🤖 cs1robots Simulation` badge.
2. **Preloaded Starter Code**:
   Monaco editor automatically opens with the pre-initialized template:
   ```python
   from cs1robots import *

   # Initialize world and robot
   create_world(avenues=10, streets=10)
   hubot = Robot(avenue=1, street=1, orientation='E', beepers=0)

   # --- WRITE YOUR SOLUTION CODE BELOW ---
   ```
3. **Available Robot Primitives**:
   - `hubot.move()` — Moves forward 1 intersection (raises `WallCollisionError` if blocked).
   - `hubot.turn_left()` — Turns 90° counter-clockwise.
   - `hubot.pick_beeper()` — Picks up 1 beeper from the ground.
   - `hubot.drop_beeper()` — Drops 1 beeper from the bag onto the ground.
   - `hubot.front_is_clear()` — Returns `True` if no wall/boundary is ahead.
   - `hubot.left_is_clear()`, `hubot.right_is_clear()`
   - `hubot.facing_north()`
   - `hubot.on_beeper()` — Returns `True` if ground has at least 1 beeper.
   - `hubot.carries_beepers()` — Returns `True` if robot has beepers in bag.

---

## 4. Example Problems

### Example A: Hurdle Race
```python
from cs1robots import *

create_world(avenues=10, streets=10)
hubot = Robot(color='yellow')

def turn_right():
    for _ in range(3):
        hubot.turn_left()

def jump_hurdle():
    hubot.turn_left()
    hubot.move()
    turn_right()
    hubot.move()
    turn_right()
    hubot.move()
    hubot.turn_left()

while hubot.avenue < 10:
    if hubot.front_is_clear():
        hubot.move()
    else:
        jump_hurdle()
```

### Example B: Beeper Harvesting
```python
from cs1robots import *

create_world(avenues=5, streets=5)
hubot = Robot(color='yellow')

while not hubot.on_beeper() and hubot.front_is_clear():
    hubot.move()

while hubot.on_beeper():
    hubot.pick_beeper()
```

---

*Developed by Focus ASTU Excellence Team, Tech Community, CP Division.*
