const fs = require('fs');
const path = require('path');

/**
 * Performance Metrics Collector
 * Collects latency, throughput, gas usage for academic benchmark
 */
class MetricsCollector {
  constructor(testName = 'default') {
    this.testName = testName;
    this.metrics = [];
    this.startTime = Date.now();
    this.gasUsedTotal = 0n;
    this.successCount = 0;
    this.failureCount = 0;
    this.errors = [];
  }

  recordVote(voteData) {
    const {
      voterId,
      latencyMs,
      gasUsed,
      success,
      error,
      burnerAddress,
      transactionHash,
      blockNumber,
      timestamp
    } = voteData;

    const metric = {
      voterId,
      latencyMs,
      gasUsed: gasUsed ? String(gasUsed) : '0',
      success,
      error: error ? error.substring(0, 100) : null,
      burnerAddress,
      transactionHash,
      blockNumber,
      timestamp
    };

    this.metrics.push(metric);

    if (success) {
      this.successCount++;
      if (gasUsed) {
        this.gasUsedTotal += BigInt(gasUsed);
      }
    } else {
      this.failureCount++;
      if (error) this.errors.push(error);
    }
  }

  getStats() {
    const totalVotes = this.metrics.length;
    const latencies = this.metrics
      .filter(m => m.success && m.latencyMs > 0)
      .map(m => m.latencyMs)
      .sort((a, b) => a - b);

    const gasValues = this.metrics
      .filter(m => m.success && m.gasUsed !== '0')
      .map(m => BigInt(m.gasUsed));

    const getPercentile = (arr, p) => {
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)];
    };

    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    const throughput = totalVotes / elapsedSeconds;

    return {
      totalVotes,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate: totalVotes > 0 ? ((this.successCount / totalVotes) * 100).toFixed(2) + '%' : 'N/A',
      throughput: throughput.toFixed(2) + ' votes/sec',
      latencyMs: {
        min: latencies.length > 0 ? latencies[0] : 0,
        max: latencies.length > 0 ? latencies[latencies.length - 1] : 0,
        avg: latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2) : 0,
        p50: getPercentile(latencies, 50) || 0,
        p95: getPercentile(latencies, 95) || 0,
        p99: getPercentile(latencies, 99) || 0
      },
      gasUsed: {
        total: this.gasUsedTotal.toString(),
        avg: gasValues.length > 0 ? (this.gasUsedTotal / BigInt(gasValues.length)).toString() : '0',
        min: gasValues.length > 0 ? gasValues.reduce((a, b) => a < b ? a : b).toString() : '0',
        max: gasValues.length > 0 ? gasValues.reduce((a, b) => a > b ? a : b).toString() : '0'
      },
      elapsedSeconds: elapsedSeconds.toFixed(2),
      errors: this.errors.slice(0, 10) // First 10 errors
    };
  }

  saveCSV() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `results-${this.testName}-${timestamp}.csv`;
    const filepath = path.join(__dirname, 'reports', filename);

    const csv = [
      ['voterId', 'latencyMs', 'gasUsed', 'success', 'error', 'burnerAddress', 'txHash', 'blockNumber', 'timestamp'],
      ...this.metrics.map(m => [
        m.voterId,
        m.latencyMs,
        m.gasUsed,
        m.success,
        m.error || '',
        m.burnerAddress,
        m.transactionHash || '',
        m.blockNumber || '',
        m.timestamp
      ])
    ]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    fs.writeFileSync(filepath, csv);
    console.log(`\n✅ CSV saved: ${filepath}`);
    return filepath;
  }

  saveJSON() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `results-${this.testName}-${timestamp}.json`;
    const filepath = path.join(__dirname, 'reports', filename);

    const report = {
      testName: this.testName,
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      metrics: this.metrics
    };

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`✅ JSON saved: ${filepath}`);
    return filepath;
  }

  printSummary() {
    const stats = this.getStats();
    console.log('\n' + '='.repeat(70));
    console.log('📊 PERFORMANCE METRICS SUMMARY');
    console.log('='.repeat(70));
    console.log(`Test Name: ${this.testName}`);
    console.log(`Total Votes: ${stats.totalVotes} (Success: ${stats.successCount}, Failed: ${stats.failureCount})`);
    console.log(`Success Rate: ${stats.successRate}`);
    console.log(`Throughput: ${stats.throughput}`);
    console.log(`\n⏱️  Latency (ms):`);
    console.log(`   Min: ${stats.latencyMs.min}`);
    console.log(`   Avg: ${stats.latencyMs.avg}`);
    console.log(`   P50: ${stats.latencyMs.p50}`);
    console.log(`   P95: ${stats.latencyMs.p95}`);
    console.log(`   P99: ${stats.latencyMs.p99}`);
    console.log(`   Max: ${stats.latencyMs.max}`);
    console.log(`\n⛽ Gas Used:`);
    console.log(`   Total: ${stats.gasUsed.total}`);
    console.log(`   Avg/vote: ${stats.gasUsed.avg}`);
    console.log(`   Min: ${stats.gasUsed.min}`);
    console.log(`   Max: ${stats.gasUsed.max}`);
    console.log(`\n⏳ Elapsed Time: ${stats.elapsedSeconds}s`);
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors (first 10):`);
      stats.errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
    }
    console.log('='.repeat(70));
  }
}

module.exports = MetricsCollector;
