"""
Headless cs1robots simulation module for FocusAssess.
Compatible with standard KAIST CS101 / Karel the Robot curriculum.
Executes purely in-memory with zero GUI / Tkinter / display dependencies.
"""

import sys
import os
import json

class RobotError(Exception):
    """Base exception for robot simulation errors."""
    pass

class WallCollisionError(RobotError):
    """Raised when the robot crashes into a wall or world boundary."""
    pass

class NoBeeperError(RobotError):
    """Raised when picking a beeper that does not exist, or dropping with an empty bag."""
    pass


class _World:
    def __init__(self, avenues=10, streets=10):
        self.avenues = max(1, int(avenues))
        self.streets = max(1, int(streets))
        # Beepers map: (avenue, street) -> count
        self.beepers = {}
        # Walls set: ((av1, st1), (av2, st2)) sorted tuple of adjacent coordinates
        self.walls = set()
        self.robots = []
        self.trace_enabled = False

    def is_valid_coord(self, av, st):
        return 1 <= av <= self.avenues and 1 <= st <= self.streets

    def add_wall(self, av, st, direction):
        direction = direction.upper()
        d_map = {'N': (0, 1), 'S': (0, -1), 'E': (1, 0), 'W': (-1, 0)}
        if direction not in d_map:
            raise ValueError(f"Invalid wall direction: {direction}")
        dx, dy = d_map[direction]
        target = (av + dx, st + dy)
        wall_key = tuple(sorted([(av, st), target]))
        self.walls.add(wall_key)

    def has_wall_between(self, p1, p2):
        wall_key = tuple(sorted([p1, p2]))
        return wall_key in self.walls

    def set_beepers(self, av, st, count):
        if count <= 0:
            self.beepers.pop((av, st), None)
        else:
            self.beepers[(av, st)] = int(count)

    def get_beepers(self, av, st):
        return self.beepers.get((av, st), 0)

    def pick_beeper(self, av, st):
        count = self.get_beepers(av, st)
        if count <= 0:
            raise NoBeeperError(f"No beepers to pick at Avenue {av}, Street {st}!")
        if count == 1:
            del self.beepers[(av, st)]
        else:
            self.beepers[(av, st)] = count - 1

    def drop_beeper(self, av, st):
        self.beepers[(av, st)] = self.get_beepers(av, st) + 1

    def total_ground_beepers(self):
        return sum(self.beepers.values())


# Global singleton world
_CURRENT_WORLD = _World(10, 10)


def create_world(avenues=10, streets=10):
    """Creates a new world with given dimensions."""
    global _CURRENT_WORLD
    _CURRENT_WORLD = _World(avenues, streets)
    return _CURRENT_WORLD


def load_world(filepath_or_dict):
    """Loads a world from a .wld file path or dict structure."""
    global _CURRENT_WORLD
    if isinstance(filepath_or_dict, dict):
        w = create_world(filepath_or_dict.get('avenues', 10), filepath_or_dict.get('streets', 10))
        for b in filepath_or_dict.get('beepers', []):
            w.set_beepers(b.get('avenue', 1), b.get('street', 1), b.get('count', 1))
        for wall in filepath_or_dict.get('walls', []):
            w.add_wall(wall.get('avenue', 1), wall.get('street', 1), wall.get('direction', 'N'))
        return w

    if os.path.exists(filepath_or_dict):
        try:
            with open(filepath_or_dict, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                if content.startswith('{'):
                    data = json.loads(content)
                    return load_world(data)
                # Parse standard Karel / cs1robots .wld line format
                lines = content.splitlines()
                av, st = 10, 10
                for line in lines:
                    parts = line.strip().split()
                    if not parts:
                        continue
                    if parts[0].lower() == 'avenues':
                        av = int(parts[1])
                    elif parts[0].lower() == 'streets':
                        st = int(parts[1])
                w = create_world(av, st)
                for line in lines:
                    parts = line.strip().split()
                    if not parts:
                        continue
                    if parts[0].lower() == 'beepers' and len(parts) >= 4:
                        w.set_beepers(int(parts[1]), int(parts[2]), int(parts[3]))
                    elif parts[0].lower() == 'wall' and len(parts) >= 4:
                        w.add_wall(int(parts[1]), int(parts[2]), parts[3].upper())
                return w
        except Exception:
            pass

    # Fallback default
    return create_world(10, 10)


def set_trace(color="blue"):
    """Trace is a visual GUI feature; safely no-op in headless mode."""
    if _CURRENT_WORLD:
        _CURRENT_WORLD.trace_enabled = True


class Robot:
    """Headless Robot implementation compliant with cs1robots specifications."""
    
    DIRS = ['N', 'E', 'S', 'W']
    DIR_NAMES = {'N': 'North', 'E': 'East', 'S': 'South', 'W': 'West'}
    DELTAS = {'N': (0, 1), 'E': (1, 0), 'S': (0, -1), 'W': (-1, 0)}

    def __init__(self, avenue=1, street=1, orientation='E', beepers=0, color='yellow'):
        global _CURRENT_WORLD
        if _CURRENT_WORLD is None:
            create_world(10, 10)
        self.world = _CURRENT_WORLD
        self.avenue = int(avenue)
        self.street = int(street)
        self.orientation = orientation.upper()
        if self.orientation not in self.DIRS:
            self.orientation = 'E'
        self.beepers = max(0, int(beepers))
        self.color = color
        self.step_count = 0
        self.crashed = False
        self.crash_reason = None
        self.world.robots.append(self)

    def _check_boundary_or_wall(self, target_av, target_st):
        if not self.world.is_valid_coord(target_av, target_st):
            raise WallCollisionError(
                f"Robot crashed into the world boundary at Avenue {self.avenue}, Street {self.street} "
                f"while moving {self.DIR_NAMES.get(self.orientation, self.orientation)}!"
            )
        if self.world.has_wall_between((self.avenue, self.street), (target_av, target_st)):
            raise WallCollisionError(
                f"Robot crashed into a wall at Avenue {self.avenue}, Street {self.street} "
                f"while moving {self.DIR_NAMES.get(self.orientation, self.orientation)}!"
            )

    def move(self):
        """Moves 1 step forward in the current orientation."""
        if self.crashed:
            raise WallCollisionError(f"Robot is already crashed: {self.crash_reason}")
        dx, dy = self.DELTAS[self.orientation]
        next_av = self.avenue + dx
        next_st = self.street + dy
        try:
            self._check_boundary_or_wall(next_av, next_st)
            self.avenue = next_av
            self.street = next_st
            self.step_count += 1
        except WallCollisionError as e:
            self.crashed = True
            self.crash_reason = str(e)
            raise e

    def turn_left(self):
        """Rotates 90 degrees counter-clockwise."""
        idx = self.DIRS.index(self.orientation)
        self.orientation = self.DIRS[(idx - 1) % 4]

    def pick_beeper(self):
        """Picks up a beeper from the current corner."""
        try:
            self.world.pick_beeper(self.avenue, self.street)
            self.beepers += 1
        except NoBeeperError as e:
            raise NoBeeperError(f"Error at Avenue {self.avenue}, Street {self.street}: {e}")

    def drop_beeper(self):
        """Drops a beeper on the current corner."""
        if self.beepers <= 0:
            raise NoBeeperError(f"Robot has no beepers to drop at Avenue {self.avenue}, Street {self.street}!")
        self.beepers -= 1
        self.world.drop_beeper(self.avenue, self.street)

    def front_is_clear(self):
        """Returns True if the robot can move forward without collision."""
        dx, dy = self.DELTAS[self.orientation]
        next_av = self.avenue + dx
        next_st = self.street + dy
        if not self.world.is_valid_coord(next_av, next_st):
            return False
        if self.world.has_wall_between((self.avenue, self.street), (next_av, next_st)):
            return False
        return True

    def left_is_clear(self):
        """Returns True if the space to the robot's left is clear."""
        idx = self.DIRS.index(self.orientation)
        left_dir = self.DIRS[(idx - 1) % 4]
        dx, dy = self.DELTAS[left_dir]
        next_av = self.avenue + dx
        next_st = self.street + dy
        if not self.world.is_valid_coord(next_av, next_st):
            return False
        if self.world.has_wall_between((self.avenue, self.street), (next_av, next_st)):
            return False
        return True

    def right_is_clear(self):
        """Returns True if the space to the robot's right is clear."""
        idx = self.DIRS.index(self.orientation)
        right_dir = self.DIRS[(idx + 1) % 4]
        dx, dy = self.DELTAS[right_dir]
        next_av = self.avenue + dx
        next_st = self.street + dy
        if not self.world.is_valid_coord(next_av, next_st):
            return False
        if self.world.has_wall_between((self.avenue, self.street), (next_av, next_st)):
            return False
        return True

    def facing_north(self):
        """Returns True if the robot is facing North."""
        return self.orientation == 'N'

    def carries_beepers(self):
        """Returns True if the robot bag contains at least 1 beeper."""
        return self.beepers > 0

    def on_beeper(self):
        """Returns True if the current corner contains at least 1 beeper."""
        return self.world.get_beepers(self.avenue, self.street) > 0

    def set_pause(self, sec=0.1):
        """Animation delay; no-op in headless environment."""
        pass

    def get_state(self):
        return {
            'avenue': self.avenue,
            'street': self.street,
            'orientation': self.orientation,
            'beepers': self.beepers,
            'crashed': self.crashed,
            'step_count': self.step_count,
        }

    def __repr__(self):
        return (f"<Robot at ({self.avenue}, {self.street}) facing {self.orientation} "
                f"with {self.beepers} beepers>")


def verify_robot_goal(
    target_avenue=None,
    target_street=None,
    target_orientation=None,
    target_beepers=None,
    require_clean_world=False,
    robot=None
):
    """
    Automated grading verification helper for FocusAssess.
    Prints [ROBOT_SIMULATION_PASSED] if goal criteria are met,
    or [ROBOT_SIMULATION_FAILED] with detailed error explanations.
    """
    global _CURRENT_WORLD
    if robot is None:
        if not _CURRENT_WORLD or not _CURRENT_WORLD.robots:
            print("[ROBOT_SIMULATION_FAILED] No robot instance was created in your code!")
            return False
        robot = _CURRENT_WORLD.robots[0]

    if robot.crashed:
        print(f"[ROBOT_SIMULATION_FAILED] Robot crashed: {robot.crash_reason}")
        return False

    errors = []

    if target_avenue is not None and robot.avenue != int(target_avenue):
        errors.append(f"Robot ended at Avenue {robot.avenue} (expected Avenue {target_avenue})")

    if target_street is not None and robot.street != int(target_street):
        errors.append(f"Robot ended at Street {robot.street} (expected Street {target_street})")

    if target_orientation and target_orientation.upper() != 'ANY':
        target_dir = target_orientation.upper()
        if robot.orientation != target_dir:
            errors.append(f"Robot is facing {Robot.DIR_NAMES.get(robot.orientation, robot.orientation)} "
                          f"(expected {Robot.DIR_NAMES.get(target_dir, target_dir)})")

    if target_beepers is not None and robot.beepers != int(target_beepers):
        errors.append(f"Robot has {robot.beepers} beepers in its bag (expected {target_beepers})")

    if require_clean_world:
        remaining = _CURRENT_WORLD.total_ground_beepers()
        if remaining > 0:
            errors.append(f"{remaining} beeper(s) remain uncollected on the ground")

    if errors:
        print("[ROBOT_SIMULATION_FAILED] " + "; ".join(errors))
        return False
    else:
        print(f"[ROBOT_SIMULATION_PASSED] Successfully reached ({robot.avenue}, {robot.street}) "
              f"facing {robot.orientation} with {robot.beepers} beeper(s) in {robot.step_count} steps.")
        return True

