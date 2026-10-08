"use client";

// Reading the flats an address offered or took: the ids from flats_of(address), then each flat,
// newest first, two at a time so a page stays inside Studio's read limit.

import { readEach } from "@/components/read-state";
import { readFlat, readFlatsOf } from "@/lib/chain";
import type { Flat, ReadResult } from "@/lib/types";

/** How many of each list are read in full. */
export const SHOWN = 12;

export async function readMine(address: string): Promise<ReadResult<{ landlord: Flat[]; tenant: Flat[]; more: { landlord: number; tenant: number } }>> {
  const ids = await readFlatsOf(address);
  const newest = (list: string[]) => [...list].reverse().slice(0, SHOWN);
  const read = async (list: string[]) =>
    (await readEach(newest(list), (id) => readFlat(id))).flatMap((r) => (r.status === "fulfilled" && r.value.data ? [r.value.data] : []));
  const landlord = await read(ids.data.landlord);
  const tenant = await read(ids.data.tenant);
  return {
    data: {
      landlord,
      tenant,
      more: { landlord: Math.max(0, ids.data.landlord.length - SHOWN), tenant: Math.max(0, ids.data.tenant.length - SHOWN) },
    },
    source: ids.source,
  };
}
