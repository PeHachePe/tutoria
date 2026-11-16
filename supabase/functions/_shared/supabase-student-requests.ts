import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { StudentRequestKind, StudentRequests } from './student-requests.ts';

/** `claim_student_request` (20261116120000_edge_functions_review.sql), with `service_role`. */
export class SupabaseStudentRequests implements StudentRequests {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async claim(
    userId: string,
    kind: StudentRequestKind,
    perMinute: number,
    perDay?: number,
  ): Promise<number> {
    const { data, error } = await this.admin.rpc('claim_student_request', {
      target_user_id: userId,
      request_kind: kind,
      per_minute: perMinute,
      per_day: perDay,
    });
    if (error) throw new Error(`Claiming the request failed: ${error.message}`);
    return data;
  }
}
