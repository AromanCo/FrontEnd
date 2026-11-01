#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIN_FREE_RESERVE_GB = 10;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const result = (id, status, detail) => ({ id, status, detail });

export function assessCapacity(input) {
  const errors = [];
  if (!input || input.format !== 1) errors.push('format must equal 1.');
  const hardware = input?.hardware;
  for (const field of ['cpu_count', 'memory_total_gib', 'memory_available_gib', 'swap_gib', 'root_disk_total_gib', 'root_disk_free_gib', 'root_inode_used_percent']) {
    if (!finite(hardware?.[field])) errors.push(`hardware.${field} must be a non-negative number.`);
  }
  if (hardware?.root_inode_used_percent > 100) errors.push('hardware.root_inode_used_percent must not exceed 100.');
  const hostContext = input?.host_context;
  if (!Number.isInteger(hostContext?.existing_container_count) || hostContext.existing_container_count < 0
    || typeof hostContext.nginx_active !== 'boolean' || typeof hostContext.ufw_active !== 'boolean') errors.push('host_context must include sanitized container count and Nginx/UFW active states.');
  const usage = input?.docker_usage_gib;
  for (const field of ['images', 'volumes', 'build_cache']) if (usage?.[field] !== null && !finite(usage?.[field])) errors.push(`docker_usage_gib.${field} must be a non-negative number or null.`);
  const proposal = input?.proposed_aroman;
  for (const field of ['frontend_memory_gib', 'backend_memory_gib', 'database_memory_gib', 'frontend_cpu', 'backend_cpu', 'database_cpu', 'migration_memory_gib', 'migration_cpu']) {
    if (!finite(proposal?.[field])) errors.push(`proposed_aroman.${field} must be a non-negative number.`);
  }
  if (proposal?.host_port !== null && (!Number.isInteger(proposal?.host_port) || proposal.host_port < 1 || proposal.host_port > 65535)) errors.push('proposed_aroman.host_port must be an unprivileged port number or null.');
  if (!Array.isArray(input?.existing_workloads) || !Array.isArray(input?.existing_published_ports)) errors.push('existing_workloads and existing_published_ports must be arrays.');
  for (const workload of input?.existing_workloads || []) {
    if (!workload || typeof workload.name !== 'string' || !workload.name.trim()) errors.push('each existing workload requires a sanitized name.');
    if (![true, false, null].includes(workload?.cpu_limits) || ![true, false, null].includes(workload?.memory_limits)) errors.push('existing workload CPU and memory limit state must be true, false or null.');
  }
  for (const item of input?.existing_published_ports || []) {
    const port = Number(typeof item === 'object' ? item.port : item);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('each existing published port must be an integer from 1 to 65535.');
  }
  if (typeof input?.network_firewall_uncertainty !== 'boolean' || typeof input?.nginx_routing_checked !== 'boolean') errors.push('network_firewall_uncertainty and nginx_routing_checked must be boolean.');
  const estimates = input?.storage_estimates_gib;
  for (const field of ['release_image', 'build_growth', 'database_growth', 'logs', 'backup', 'rollback_artifact']) {
    if (estimates?.[field] !== null && !finite(estimates?.[field])) errors.push(`storage_estimates_gib.${field} must be a non-negative number or null.`);
  }
  if (errors.length) return { format: 1, source_kind: input?.source_kind ?? 'unspecified', deployable: false, errors, checks: [] };

  const checks = [];
  const historical = String(input.source_kind ?? '').toLowerCase().startsWith('historical');
  checks.push(result('inode_headroom', historical ? 'UNVERIFIED' : hardware.root_inode_used_percent >= 85 ? 'BLOCKED' : hardware.root_inode_used_percent >= 70 ? 'WARNING' : 'PASS', `${hardware.root_inode_used_percent.toFixed(1)}% inode use is supplied measurement only; recheck on target and retain inode headroom.`));
  const unknownDisk = Object.values(usage).some(value => value === null) || Object.values(estimates).some(value => value === null);
  const incremental = Object.values(estimates).reduce((sum, value) => sum + (value ?? 0), 0);
  const after = hardware.root_disk_free_gib - incremental;
  if (unknownDisk) checks.push(result('disk_headroom', 'UNVERIFIED', `Docker usage and/or storage estimates are incomplete; do not treat unknown values as zero. Supplied free space is ${hardware.root_disk_free_gib.toFixed(2)} GiB, only ${(hardware.root_disk_free_gib - MIN_FREE_RESERVE_GB).toFixed(2)} GiB above the provisional reserve before unmeasured growth.`));
  else if (after < MIN_FREE_RESERVE_GB) checks.push(result('disk_headroom', 'BLOCKED', `Projected free disk ${after.toFixed(2)} GiB is below the ${MIN_FREE_RESERVE_GB} GiB safety reserve.`));
  else if (historical) checks.push(result('disk_headroom', 'UNVERIFIED', `Historical supplied values project ${after.toFixed(2)} GiB free, but are not live target measurements.`));
  else checks.push(result('disk_headroom', 'PASS', `Projected free disk ${after.toFixed(2)} GiB retains the ${MIN_FREE_RESERVE_GB} GiB reserve under supplied estimates only.`));
  checks.push(result('image_build_growth', unknownDisk ? 'UNVERIFIED' : 'WARNING', 'Release image, build cache, rollback artifact and data/log growth require measured values and ongoing limits; automatic cleanup is not proposed.'));
  checks.push(result('database_logs', estimates.database_growth === null || estimates.logs === null ? 'UNVERIFIED' : 'WARNING', 'Database and log growth are estimates, not observed production rates.'));
  checks.push(result('backup_recovery_storage', estimates.backup === null ? 'UNVERIFIED' : estimates.backup > hardware.root_disk_free_gib ? 'BLOCKED' : 'WARNING', 'Backup location, isolation, retention, encryption and restore rehearsal still require owner approval.'));
  const runtimeMemory = proposal.frontend_memory_gib + proposal.backend_memory_gib + proposal.database_memory_gib;
  const availableAfter = hardware.memory_available_gib - runtimeMemory;
  checks.push(availableAfter < 2 ? result('shared_host_memory', 'BLOCKED', `Supplied available memory leaves ${availableAfter.toFixed(2)} GiB before host overhead; 2 GiB is the provisional reserve.`) : result('shared_host_memory', 'WARNING', `Supplied limits leave ${availableAfter.toFixed(2)} GiB before host overhead; shared-host contention remains unmeasured.`));
  const cpuDemand = proposal.frontend_cpu + proposal.backend_cpu + proposal.database_cpu;
  const noLimits = input.existing_workloads.filter(item => item.cpu_limits !== true || item.memory_limits !== true).map(item => item.name);
  checks.push(cpuDemand > hardware.cpu_count * 0.5 ? result('cpu_contention', 'BLOCKED', 'Proposed steady-state CPU limits exceed half of the reported host CPU capacity.') : result('cpu_contention', 'WARNING', noLimits.length ? `AROMAN CPU limits are bounded, but supplied existing workloads lack explicit CPU/memory limits or measurements: ${noLimits.join(', ')}.` : 'AROMAN CPU limits are bounded and existing workloads report limits; host utilization and contention remain unmeasured.'));
  const occupied = new Set(input.existing_published_ports.map(item => Number(typeof item === 'object' ? item.port : item)));
  if (proposal.host_port === null) checks.push(result('port_conflict', 'UNVERIFIED', 'No AROMAN host port has been selected; target inventory and Nginx routing must be checked before assignment.'));
  else checks.push(occupied.has(proposal.host_port) ? result('port_conflict', 'BLOCKED', `Proposed host port ${proposal.host_port} appears in the supplied existing published-port inventory.`) : result('port_conflict', historical ? 'UNVERIFIED' : 'PASS', historical ? `Historical inventory does not report port ${proposal.host_port}; target inspection remains required.` : `Proposed host port ${proposal.host_port} is absent from the supplied inventory only; target inspection remains required.`));
  checks.push(result('network_isolation', input.network_firewall_uncertainty === true ? 'UNVERIFIED' : 'WARNING', `Nginx ${hostContext.nginx_active ? 'was reported active' : 'state not active in supplied snapshot'}; UFW ${hostContext.ufw_active ? 'was reported active' : 'state not active in supplied snapshot'}. Docker/UFW behavior, reachability, dedicated network membership and host forwarding require approved IPv4 and IPv6 verification.`));
  checks.push(result('nginx_routing', input.nginx_routing_checked === true ? 'WARNING' : 'UNVERIFIED', 'Nginx and AROMAN coming-soon route, vhost and upstream collision checks require target evidence.'));
  checks.push(result('existing_service_blast_radius', 'WARNING', 'The same host contains protected unrelated applications; no AROMAN operation may modify, reconnect, rebuild or clean their resources.'));
  checks.push(result('single_host_failure_domain', 'WARNING', 'Architecture A shares the Afra host and provider failure domain; recovery and downtime acceptance are unresolved.'));
  checks.push(result('ipv4_ipv6_firewall', 'UNVERIFIED', 'Verify Docker NAT/filter behavior, IPv4 and IPv6 forwarding, UFW effective rules and external reachability from an authorized vantage point.'));
  const statuses = new Set(checks.map(item => item.status));
  const disposition = statuses.has('BLOCKED') ? 'BLOCKED' : statuses.has('UNVERIFIED') ? 'UNVERIFIED' : statuses.has('WARNING') ? 'WARNING' : 'PASS';
  return {
    format: 1, source_kind: input.source_kind ?? 'manual-sanitized-measurements',
    target_acceptance: false, deployable: false, disposition,
    planning_only_root_disk_target_gib: input.planned_root_disk_target_gib ?? null,
    planning_note: 'The approximately 80 GiB root-disk target is planning only and excluded from all capacity arithmetic until separately approved and measured as completed.',
    supplied_snapshot: { root_disk_total_gib: hardware.root_disk_total_gib, root_disk_free_gib: hardware.root_disk_free_gib, root_inode_used_percent: hardware.root_inode_used_percent, cpu_count: hardware.cpu_count, memory_total_gib: hardware.memory_total_gib, memory_available_gib: hardware.memory_available_gib, swap_gib: hardware.swap_gib, existing_container_count: hostContext.existing_container_count, nginx_active: hostContext.nginx_active, ufw_active: hostContext.ufw_active },
    storage_projection_gib: { incremental: unknownDisk ? null : incremental, free_after: unknownDisk ? null : after, minimum_reserve: MIN_FREE_RESERVE_GB },
    checks,
  };
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length !== 1) { console.error('Usage: node scripts/assess-afra-capacity.mjs <sanitized-measurements.json>'); return 2; }
  try {
    const report = assessCapacity(JSON.parse(readFileSync(argv[0], 'utf8')));
    console.log(JSON.stringify(report, null, 2));
    return report.errors?.length || report.disposition === 'BLOCKED' ? 1 : 0;
  } catch (cause) { console.error(`Unable to assess input: ${cause.message}`); return 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
