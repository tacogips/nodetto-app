//! The picture's scan budget, shared by the render workers.

use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};

/// Workers publish their charges in chunks of this size.
pub(super) const CHUNK: u64 = 1_048_576;

pub(super) struct ScanBudget {
    allowance: u64,
    triangle_limit: u64,
    triangles: AtomicU64,
    visited: AtomicU64,
    charged: AtomicU64,
    reads: AtomicU64,
    witness: AtomicU64,
    workers: AtomicUsize,
    layer_capacity: AtomicUsize,
    stopped: AtomicBool,
}

impl ScanBudget {
    pub(super) fn new(allowance: u64, triangle_limit: u64) -> Self {
        Self {
            allowance,
            triangle_limit,
            triangles: AtomicU64::new(0),
            visited: AtomicU64::new(0),
            charged: AtomicU64::new(0),
            reads: AtomicU64::new(0),
            witness: AtomicU64::new(0),
            workers: AtomicUsize::new(0),
            layer_capacity: AtomicUsize::new(0),
            stopped: AtomicBool::new(false),
        }
    }

    pub(super) fn triangles(&self) -> u64 {
        self.triangles.load(Ordering::Relaxed)
    }

    pub(super) fn visited(&self) -> u64 {
        self.visited.load(Ordering::Relaxed)
    }

    /// True once any worker has charged past the allowance.
    pub(super) fn stopped(&self) -> bool {
        self.stopped.load(Ordering::Relaxed)
    }

    /// Boundary reads of the workers that have finished.
    pub(super) fn reads(&self) -> u64 {
        self.reads.load(Ordering::Relaxed)
    }

    pub(super) fn charged(&self) -> u64 {
        self.charged.load(Ordering::Relaxed)
    }

    pub(super) fn witness(&self) -> u64 {
        self.witness.load(Ordering::Relaxed)
    }

    pub(super) fn workers(&self) -> usize {
        self.workers.load(Ordering::Relaxed)
    }

    pub(super) fn record_layer_capacity(&self, capacity: usize) {
        self.layer_capacity.fetch_max(capacity, Ordering::Relaxed);
    }

    pub(super) fn layer_capacity(&self) -> usize {
        self.layer_capacity.load(Ordering::Relaxed)
    }

    /// Register one worker and return its local account.
    pub(super) fn worker(&self) -> WorkerBudget<'_> {
        self.workers.fetch_add(1, Ordering::Relaxed);
        WorkerBudget {
            shared: self,
            visited: 0,
            pending: 0,
            reads: 0,
            witness: 0,
        }
    }
}

pub(super) struct WorkerBudget<'a> {
    shared: &'a ScanBudget,
    visited: u64,
    pending: u64,
    reads: u64,
    witness: u64,
}

impl WorkerBudget<'_> {
    pub(super) fn traverse(&mut self, entries: usize) -> bool {
        if entries == 0 {
            return true;
        }
        let entries = entries as u64;
        let after = self.shared.triangles.fetch_add(entries, Ordering::Relaxed) + entries;
        if after > self.shared.triangle_limit {
            self.shared.stopped.store(true, Ordering::Relaxed);
            return false;
        }
        self.visited += entries;
        true
    }

    /// Stop all workers when bounded sample storage is exhausted.
    pub(super) fn stop(&mut self) {
        self.shared.stopped.store(true, Ordering::Relaxed);
    }

    /// Publish pending charges. False when the picture must stop.
    pub(super) fn flush(&mut self) -> bool {
        let total = self
            .shared
            .charged
            .fetch_add(self.pending, Ordering::Relaxed)
            + self.pending;
        self.pending = 0;
        if total > self.shared.allowance {
            self.shared.stopped.store(true, Ordering::Relaxed);
        }
        !self.shared.stopped()
    }

    /// Charge interval boundaries read while combining a sample.
    pub(super) fn charge(&mut self, count: u64) -> bool {
        self.pending += count;
        if self.pending >= CHUNK && !self.flush() {
            return false;
        }
        self.reads += count;
        true
    }

    /// Charge the edges or triangles a ray tests beyond the weight its
    /// tool was admitted with. Admission averages a tool's buckets, so a
    /// view zoomed onto one dense bucket would otherwise scan it for every
    /// sample without limit.
    pub(super) fn scan(&mut self, tested: usize, admitted: u64) -> bool {
        let surplus = (tested as u64).saturating_sub(admitted);
        if surplus == 0 {
            return true;
        }
        self.pending += surplus;
        self.pending < CHUNK || self.flush()
    }

    pub(super) fn recast(&mut self, tested: usize) -> bool {
        if !self.scan(tested, 0) {
            return false;
        }
        self.witness += tested as u64;
        true
    }

    pub(super) fn charge_witness(&mut self, count: u64) -> bool {
        if !self.charge(count) {
            return false;
        }
        self.witness += count;
        true
    }

    pub(super) fn stopped(&self) -> bool {
        self.shared.stopped()
    }
}

impl Drop for WorkerBudget<'_> {
    fn drop(&mut self) {
        self.flush();
        self.shared
            .visited
            .fetch_add(self.visited, Ordering::Relaxed);
        self.shared.reads.fetch_add(self.reads, Ordering::Relaxed);
        self.shared
            .witness
            .fetch_add(self.witness, Ordering::Relaxed);
    }
}
