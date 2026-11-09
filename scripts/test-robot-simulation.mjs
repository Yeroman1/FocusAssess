/**
 * End-to-End Test Suite for FocusAssess Robot Simulation Engine
 * Verifies that the headless cs1robots engine, sandbox runner, and autograding
 * harness function properly end-to-end.
 */

const RUNNER_URL = process.env.PYTHON_RUNNER_URL || 'http://localhost:5001';
const RUNNER_SECRET = process.env.PYTHON_RUNNER_SECRET || 'dev-isolated-runner-secret-key-astu-2026';

async function executeTestJob(name, sourceCode, checkGoal) {
  process.stdout.write(`Testing: ${name}... `);

  const payload = {
    jobId: `test-${Date.now()}`,
    sourceCode,
    stdin: JSON.stringify({ check_goal: checkGoal }),
    timeoutMs: 4000,
  };

  const res = await fetch(`${RUNNER_URL}/internal/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-runner-secret': RUNNER_SECRET,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Runner returned HTTP ${res.status}: ${text}`);
  }

  const result = await res.json();
  return result;
}

async function runAllTests() {
  console.log('=== FocusAssess Robot Simulation E2E Test Suite ===\n');

  let passed = 0;
  let total = 0;

  // Test 1: Navigation to Target Goal
  total++;
  try {
    const code = `from cs1robots import *
create_world(avenues=10, streets=10)
hubot = Robot(avenue=1, street=1, orientation='E', beepers=0)
for _ in range(4):
    hubot.move()
`;
    const result = await executeTestJob(
      'Robot Navigation to (5, 1)',
      code,
      { target_avenue: 5, target_street: 1, target_orientation: 'E', target_beepers: 0 }
    );

    if (result.stdout.includes('[ROBOT_SIMULATION_PASSED]')) {
      console.log('PASSED (' + result.durationMs + 'ms)');
      passed++;
    } else {
      console.log('FAILED: ' + result.stdout + (result.stderr || ''));
    }
  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  // Test 2: Beeper Harvesting
  total++;
  try {
    const code = `from cs1robots import *
w = create_world(avenues=5, streets=5)
w.set_beepers(2, 1, 3)
hubot = Robot(avenue=1, street=1, orientation='E', beepers=0)
hubot.move()
for _ in range(3):
    hubot.pick_beeper()
`;
    const result = await executeTestJob(
      'Beeper Harvesting (3 beepers)',
      code,
      { target_avenue: 2, target_street: 1, target_beepers: 3, require_clean_world: true }
    );

    if (result.stdout.includes('[ROBOT_SIMULATION_PASSED]')) {
      console.log('PASSED (' + result.durationMs + 'ms)');
      passed++;
    } else {
      console.log('FAILED: ' + result.stdout + (result.stderr || ''));
    }
  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  // Test 3: Detecting Goal Failure (stopped at wrong coordinate)
  total++;
  try {
    const code = `from cs1robots import *
create_world(avenues=10, streets=10)
hubot = Robot(avenue=1, street=1, orientation='E', beepers=0)
hubot.move()
`;
    const result = await executeTestJob(
      'Failure Detection (stopped early at Avenue 2 instead of 10)',
      code,
      { target_avenue: 10, target_street: 1 }
    );

    if (result.stdout.includes('[ROBOT_SIMULATION_FAILED]')) {
      console.log('PASSED (Correctly rejected with [ROBOT_SIMULATION_FAILED])');
      passed++;
    } else {
      console.log('UNEXPECTED: Did not fail when expected. Output: ' + result.stdout);
    }
  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  // Test 4: Wall / Boundary Collision Guard
  total++;
  try {
    const code = `from cs1robots import *
create_world(avenues=3, streets=3)
hubot = Robot(avenue=1, street=1, orientation='S', beepers=0)
hubot.move() # Crashes into South world boundary
`;
    const result = await executeTestJob(
      'Collision Guard (Boundary crash into South wall)',
      code,
      { target_avenue: 1, target_street: 1 }
    );

    const fullOutput = `${result.stdout || ''} ${result.stderr || ''} ${result.error || ''}`;
    if (fullOutput.includes('WallCollisionError') || fullOutput.includes('[ROBOT_SIMULATION_FAILED]')) {
      console.log('PASSED (Boundary collision safely trapped)');
      passed++;
    } else {
      console.log('UNEXPECTED: ' + fullOutput);
    }
  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  console.log(`\nResults: ${passed} / ${total} tests passed.`);
  if (passed === total) {
    console.log('✓ All Robot Simulation E2E tests succeeded!\n');
  } else {
    process.exit(1);
  }
}

runAllTests();
