#!/usr/bin/env node
// One-shot data migration: public.* in bqbidqffijfizsciksnv → esc.* in mgfjswovpfrzjutmbevr.
//
// Usage (from C:\Programacion\agenda):
//   ESC_OLD_KEY="<old service_role>" ESC_NEW_KEY="<unified service_role>" node scripts/migrate-esc.mjs
//
// Re-runnable (uses upsert + delete-then-insert for trigger-tainted tables).
// Delete this script after the cutover validates.

import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://bqbidqffijfizsciksnv.supabase.co';
const NEW_URL = 'https://mgfjswovpfrzjutmbevr.supabase.co';
const OLD_KEY = process.env.ESC_OLD_KEY;
const NEW_KEY = process.env.ESC_NEW_KEY;

if (!OLD_KEY || !NEW_KEY) {
  console.error('Set ESC_OLD_KEY and ESC_NEW_KEY env vars (service_role keys).');
  process.exit(1);
}

// UUID remap: lbernal had different UUID in old Esc vs unified
const OLD_LBERNAL = '8090a93f-c503-4504-bb64-3f057599c30f';
const NEW_LBERNAL = '54d01009-faa3-4f8c-86bf-eea1ee6beca7';
const remapId = (id) => (id === OLD_LBERNAL ? NEW_LBERNAL : id);

const old = createClient(OLD_URL, OLD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const neu = createClient(NEW_URL, NEW_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'esc' },
});

async function fetchAll(table, orderBy = 'id') {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await old
      .from(table)
      .select('*')
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

function applyRemap(rows, fields) {
  if (!fields.length) return rows;
  return rows.map((r) => {
    const out = { ...r };
    for (const f of fields) {
      if (typeof out[f] === 'string') out[f] = remapId(out[f]);
    }
    return out;
  });
}

async function chunkUpsert(table, rows, opts = {}) {
  const { chunkSize = 500, onConflict = 'id', remapFields = [] } = opts;
  const mapped = applyRemap(rows, remapFields);
  let inserted = 0;
  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const { error } = await neu.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`upsert ${table} chunk @ ${i}: ${error.message}`);
    inserted += chunk.length;
    process.stdout.write(`  ${table}: ${inserted}/${mapped.length}\r`);
  }
  process.stdout.write(`  ${table}: ${inserted}/${mapped.length}\n`);
  return inserted;
}

async function migrateTable(table, opts = {}) {
  const { orderBy = 'id', onConflict = 'id', remapFields = [] } = opts;
  const t0 = Date.now();
  const rows = await fetchAll(table, orderBy);
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows`);
    return 0;
  }
  const n = await chunkUpsert(table, rows, { onConflict, remapFields });
  console.log(`  ${table}: ${n} rows in ${Date.now() - t0}ms`);
  return n;
}

async function deleteAll(table) {
  const { error } = await neu.from(table).delete().not('id', 'is', null);
  if (error) throw new Error(`delete ${table}: ${error.message}`);
}

async function main() {
  const start = Date.now();
  console.log('Esc migration → mgfjswovpfrzjutmbevr starting...\n');

  console.log('Phase 1: catalogs (no FKs)');
  await migrateTable('app_config', { orderBy: 'key', onConflict: 'key' });
  await migrateTable('esquemas_pago');
  await migrateTable('etapas_esquema');
  await migrateTable('documentos_etapa');
  await migrateTable('unidades');

  console.log('\nPhase 2: compradores (remap responsable_id)');
  await migrateTable('compradores', { remapFields: ['responsable_id'] });

  console.log('\nPhase 3: procesos + etapas_proceso');
  // Strategy: insert procesos with etapa_actual_id=null (triggers will create
  // etapas, but they're noisy not destructive). Delete auto-created etapas, then
  // insert real etapas. Then UPDATE procesos.etapa_actual_id from old data.
  const procesos = await fetchAll('procesos');
  const procesosNoEtapaActual = applyRemap(procesos, ['responsable_id']).map((p) => ({
    ...p,
    etapa_actual_id: null,
  }));
  await chunkUpsert('procesos', procesosNoEtapaActual);

  // Clear auto-created etapas
  console.log('  clearing auto-created etapas_proceso...');
  await deleteAll('etapas_proceso');

  // Insert real etapas_proceso
  await migrateTable('etapas_proceso', { remapFields: ['asignado_a'] });

  // Restore procesos.etapa_actual_id
  console.log('  restoring procesos.etapa_actual_id...');
  const etapaActualMap = procesos
    .filter((p) => p.etapa_actual_id)
    .map((p) => ({ id: p.id, etapa_actual_id: p.etapa_actual_id }));
  for (let i = 0; i < etapaActualMap.length; i += 100) {
    const chunk = etapaActualMap.slice(i, i + 100);
    for (const row of chunk) {
      const { error } = await neu.from('procesos').update({ etapa_actual_id: row.etapa_actual_id }).eq('id', row.id);
      if (error) throw new Error(`update procesos.etapa_actual_id ${row.id}: ${error.message}`);
    }
    process.stdout.write(`  procesos.etapa_actual_id: ${Math.min(i + 100, etapaActualMap.length)}/${etapaActualMap.length}\r`);
  }
  process.stdout.write(`  procesos.etapa_actual_id restored: ${etapaActualMap.length}\n`);

  console.log('\nPhase 4: documentos_proceso, pagos');
  await migrateTable('documentos_proceso');
  await migrateTable('pagos');

  console.log('\nPhase 5: comentarios + actividad (clear-then-insert to remove trigger noise)');
  await migrateTable('comentarios_proceso', { remapFields: ['autor_id'] });

  console.log('  clearing trigger-generated actividad_proceso...');
  await deleteAll('actividad_proceso');
  await migrateTable('actividad_proceso', { remapFields: ['actor_id'] });

  console.log('\nVerifying counts:');
  for (const t of [
    'app_config', 'esquemas_pago', 'etapas_esquema', 'documentos_etapa', 'unidades',
    'compradores', 'procesos', 'etapas_proceso', 'documentos_proceso', 'pagos',
    'comentarios_proceso', 'actividad_proceso',
  ]) {
    const { count: oldN } = await old.from(t).select('*', { count: 'exact', head: true });
    const { count: newN } = await neu.from(t).select('*', { count: 'exact', head: true });
    const status = oldN === newN ? 'OK' : 'MISMATCH';
    console.log(`  ${t.padEnd(22)} old=${oldN} new=${newN} [${status}]`);
  }

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error('\nFATAL:', e.message);
  process.exit(1);
});
