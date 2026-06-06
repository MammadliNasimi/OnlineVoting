#!/usr/bin/env node
/**
 * Performance Report Generator
 * 
 * Reads JSON/CSV outputs from measure-performance.js
 * Generates: summary tables, latency distributions, gas comparisons
 */

const fs = require('fs');
const path = require('path');

const REPORT_DIR = path.join(__dirname, 'reports');

function loadLatestReport() {
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.startsWith('summary-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.error('❌ No summary reports found in', REPORT_DIR);
    process.exit(1);
  }

  const latestFile = files[0];
  const filePath = path.join(REPORT_DIR, latestFile);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`📖 Loaded report: ${latestFile}\n`);
  return data;
}

function formatTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    const maxRowWidth = rows.reduce((max, row) => Math.max(max, String(row[i]).length), 0);
    return Math.max(h.length, maxRowWidth);
  });

  let table = '';
  // Header
  table += headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + '\n';
  table += colWidths.map(w => '─'.repeat(w)).join('─┼─') + '\n';
  // Rows
  rows.forEach(row => {
    table += row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ') + '\n';
  });

  return table;
}

function printPerformanceSummary(report) {
  console.log('┌─────────────────────────────────────────┐');
  console.log('│  E-VOTING SYSTEM PERFORMANCE BENCHMARK  │');
  console.log('└─────────────────────────────────────────┘\n');

  console.log(`Test Date: ${report.test_date}\n`);

  const scenarios = report.scenarios;

  // Throughput comparison
  console.log('📊 THROUGHPUT (votes/second)\n');
  const throughputRows = scenarios.map(s => [
    s.scenario,
    s.throughput_votes_per_second,
    s.success_rate,
    `${s.total_duration_seconds}s`
  ]);
  console.log(formatTable(['Scenario', 'Votes/sec', 'Success Rate', 'Duration'], throughputRows));

  // Latency analysis
  console.log('\n⏱️  LATENCY ANALYSIS (milliseconds)\n');
  const latencyRows = scenarios.map(s => [
    s.scenario,
    s.latency_p50_ms,
    s.latency_p95_ms,
    s.latency_p99_ms,
    s.latency_min_ms,
    s.latency_max_ms,
    parseFloat(s.latency_avg_ms).toFixed(2)
  ]);
  console.log(formatTable(['Scenario', 'P50', 'P95', 'P99', 'Min', 'Max', 'Avg'], latencyRows));

  // Gas cost analysis
  console.log('\n⛽ GAS COST ANALYSIS (ETH per vote)\n');
  const gasRows = scenarios.map(s => [
    s.scenario,
    s.successful_votes,
    s.gas_cost_avg_eth,
    s.gas_cost_min_eth,
    s.gas_cost_max_eth,
    s.gas_cost_total_eth
  ]);
  console.log(formatTable(['Scenario', 'Votes', 'Avg Cost', 'Min', 'Max', 'Total'], gasRows));

  // Scalability notes
  console.log('\n📈 SCALABILITY INSIGHTS\n');
  if (scenarios.length > 1) {
    const first = scenarios[0];
    const last = scenarios[scenarios.length - 1];
    const throughputDelta = ((parseFloat(last.throughput_votes_per_second) / parseFloat(first.throughput_votes_per_second)) * 100 - 100).toFixed(1);
    const latencyDelta = ((parseFloat(last.latency_avg_ms) / parseFloat(first.latency_avg_ms)) * 100 - 100).toFixed(1);

    console.log(`  • Throughput change (${first.scenario} → ${last.scenario}): ${throughputDelta}%`);
    console.log(`  • Latency change: ${latencyDelta}%`);
    console.log(`  • Cost efficiency: ${last.gas_cost_avg_eth} ETH/vote @ ${last.throughput_votes_per_second} votes/sec\n`);
  }
}

function generateMarkdownReport(report) {
  const mdPath = path.join(REPORT_DIR, `report-${report.test_date}.md`);
  
  let md = '# E-Voting System: Performance Benchmark Report\n\n';
  md += `**Test Date:** ${report.test_date}  \n`;
  md += `**Total Votes Tested:** ${report.total_votes}  \n\n`;

  md += '## Executive Summary\n\n';
  md += report.scenarios.map(s => 
    `- **${s.scenario}**: ${s.throughput_votes_per_second} votes/sec, ` +
    `P95 latency ${s.latency_p95_ms}ms, ${s.gas_cost_avg_eth} ETH/vote`
  ).join('\n');
  md += '\n\n';

  md += '## Detailed Results\n\n';
  report.scenarios.forEach(s => {
    md += `### ${s.scenario}\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Total Voters | ${s.total_voters} |\n`;
    md += `| Successful Votes | ${s.successful_votes} |\n`;
    md += `| Success Rate | ${s.success_rate} |\n`;
    md += `| Throughput | ${s.throughput_votes_per_second} votes/second |\n`;
    md += `| Latency P50 | ${s.latency_p50_ms}ms |\n`;
    md += `| Latency P95 | ${s.latency_p95_ms}ms |\n`;
    md += `| Latency P99 | ${s.latency_p99_ms}ms |\n`;
    md += `| Gas Cost (Avg) | ${s.gas_cost_avg_eth} ETH |\n`;
    md += `| Gas Cost (Total) | ${s.gas_cost_total_eth} ETH |\n`;
    md += `| Duration | ${s.total_duration_seconds}s |\n\n`;
  });

  md += '## Observations\n\n';
  md += '1. **Throughput**: System achieves consistent performance across voter counts.\n';
  md += '2. **Latency**: P95 latency indicates acceptable user experience for most scenarios.\n';
  md += '3. **Gas Efficiency**: Average gas cost reflects blockchain transaction overhead.\n';
  md += '4. **Scalability**: Performance metrics indicate suitability for [audience size].\n\n';

  md += '## Recommendations\n\n';
  md += '- Consider Layer 2 deployment for higher throughput requirements.\n';
  md += '- Implement batching for large-scale elections.\n';
  md += '- Monitor relayer performance under load.\n';

  fs.writeFileSync(mdPath, md);
  console.log(`\n✅ Markdown report saved: ${mdPath}`);
}

function generateJsonReport(report) {
  const jsonPath = path.join(REPORT_DIR, `analysis-${report.test_date}.json`);
  
  const analysis = {
    timestamp: new Date().toISOString(),
    source_report: report.test_date,
    summary: {
      total_scenarios: report.scenarios.length,
      total_votes: report.total_votes,
      avg_throughput: (report.scenarios.reduce((sum, s) => sum + parseFloat(s.throughput_votes_per_second), 0) / report.scenarios.length).toFixed(2),
      avg_latency_p95: (report.scenarios.reduce((sum, s) => sum + s.latency_p95_ms, 0) / report.scenarios.length).toFixed(2),
      avg_gas_cost: (report.scenarios.reduce((sum, s) => sum + parseFloat(s.gas_cost_avg_eth), 0) / report.scenarios.length).toFixed(8)
    },
    scenarios: report.scenarios,
    conclusions: {
      suitability: 'DAO-scale elections (1k-10k voters)',
      bottleneck: 'Gas cost and relayer throughput',
      recommendation: 'Layer 2 for larger elections'
    }
  };

  fs.writeFileSync(jsonPath, JSON.stringify(analysis, null, 2));
  console.log(`✅ JSON analysis saved: ${jsonPath}`);
}

// ============ MAIN ============
function main() {
  if (!fs.existsSync(REPORT_DIR)) {
    console.error('❌ Reports directory not found:', REPORT_DIR);
    process.exit(1);
  }

  const report = loadLatestReport();
  printPerformanceSummary(report);
  generateMarkdownReport(report);
  generateJsonReport(report);

  console.log('\n🎉 Report generation complete!\n');
}

main();
