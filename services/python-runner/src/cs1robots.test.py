"""
Test suite for headless cs1robots simulation module.
Verifies movements, turns, beepers, walls, boundary crashes, and goal verification.
"""

import sys
from cs1robots import (
    create_world,
    Robot,
    WallCollisionError,
    NoBeeperError,
    verify_robot_goal,
)

def test_basic_movement():
    create_world(10, 10)
    r = Robot(1, 1, 'E', 0)
    r.move()
    r.move()
    assert (r.avenue, r.street) == (3, 1), f"Expected (3, 1), got ({r.avenue}, {r.street})"
    r.turn_left()
    assert r.orientation == 'N', f"Expected 'N', got '{r.orientation}'"
    r.move()
    assert (r.avenue, r.street) == (3, 2)
    print("✓ test_basic_movement passed")

def test_boundary_collision():
    create_world(5, 5)
    r = Robot(1, 1, 'S', 0)
    try:
        r.move()
        assert False, "Should have raised WallCollisionError"
    except WallCollisionError:
        print("✓ test_boundary_collision passed")

def test_beepers():
    w = create_world(5, 5)
    w.set_beepers(2, 2, 2)
    r = Robot(2, 2, 'E', 1)
    assert r.on_beeper()
    assert r.carries_beepers()
    r.pick_beeper()
    assert r.beepers == 2
    r.drop_beeper()
    r.drop_beeper()
    assert r.beepers == 0
    try:
        r.drop_beeper()
        assert False, "Should have raised NoBeeperError on empty bag"
    except NoBeeperError:
        print("✓ test_beepers passed")

def test_goal_verification():
    create_world(10, 10)
    r = Robot(1, 1, 'E', 0)
    for _ in range(4):
        r.move()
    passed = verify_robot_goal(target_avenue=5, target_street=1, target_orientation='E', robot=r)
    assert passed, "Goal verification should pass"
    print("✓ test_goal_verification passed")

if __name__ == '__main__':
    test_basic_movement()
    test_boundary_collision()
    test_beepers()
    test_goal_verification()
    print("All cs1robots unit tests passed successfully!")

