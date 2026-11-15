import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { StaffRequestKind, StaffRequests } from './staff-requests.ts';

/** `claim_staff_request` (20261115120000_staff_requests.sql), with `service_role`. */
export class SupabaseStaffRequests implements StaffRequests {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async claim(userId: string, kind: StaffRequestKind, perMinute: number): Promise<number | null> {
    const { data, error } = await this.admin.rpc('claim_staff_request', {
      target_user_id: userId,
      request_kind: kind,
      per_minute: perMinute,
    });
    // Raised for anyone who is not an active teacher or administrator
    if (error?.code === 'P0003') return null;
    if (error) throw new Error(`Claiming the request failed: ${error.message}`);
    return data;
  }
}
