import os from 'os';

// Admission control for resource-heavy zip downloads. The goal: let downloads use *spare*
// capacity and get out of the way the moment the box (including the co-located Postgres)
// is under pressure — so downloads can never consume all the server's resources.
//
// Three gates, all cheap to evaluate:
//   1. Concurrency — a hard cap on simultaneous zip streams.
//   2. CPU load    — normalized 1-minute load average per core (Linux/EC2). On platforms
//                    that don't report load average (e.g. Windows dev), this reads 0 and is
//                    effectively skipped.
//   3. Free memory — refuse when the system is low on RAM.
//
// All thresholds are env-tunable so you can dial them in from CloudWatch without redeploys.

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const cpuCount = Math.max(1, os.cpus()?.length || 1);

// Concurrency cap auto-sizes to the instance (≈2 per core), clamped to a sane range.
// Override with MAX_ZIP_CONCURRENCY to pin an exact value.
const MAX_CONCURRENT =
  parseInt(process.env.MAX_ZIP_CONCURRENCY, 10) || clamp(cpuCount * 2, 2, 32);

// Refuse new downloads above this normalized 1-min load average (1.0 = fully saturated).
const LOAD_THRESHOLD = parseFloat(process.env.ZIP_LOAD_THRESHOLD) || 0.85;

// Refuse new downloads when free memory drops below this fraction of total.
const MIN_FREE_MEM_RATIO = parseFloat(process.env.ZIP_MIN_FREE_MEM) || 0.15;

let active = 0;

export const downloadGuard = {
  // Try to reserve a download slot. Returns { ok: true } or { ok: false, reason }.
  tryAcquire() {
    if (active >= MAX_CONCURRENT) return { ok: false, reason: 'concurrency' };

    // os.loadavg() returns [0,0,0] on platforms without load average (e.g. Windows),
    // so this gate is a no-op there and active on Linux/EC2.
    const normalizedLoad = os.loadavg()[0] / cpuCount;
    if (normalizedLoad > LOAD_THRESHOLD) return { ok: false, reason: 'cpu' };

    const freeRatio = os.freemem() / os.totalmem();
    if (freeRatio < MIN_FREE_MEM_RATIO) return { ok: false, reason: 'memory' };

    active += 1;
    return { ok: true };
  },

  // Release a previously-acquired slot. Safe to call once per successful acquire.
  release() {
    if (active > 0) active -= 1;
  },

  stats() {
    return { active, max: MAX_CONCURRENT };
  },
};
