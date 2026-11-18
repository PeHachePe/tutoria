import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import { type GroupHistory, StatsService } from '../stats-service';
import { groupHistoryOf } from './group-history';
import { canManageGroup } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** The history of a group over MockDb (ficha 09): its teacher or the administration read it. */
@Service({ autoProvided: false })
export class MockStatsService extends StatsService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  groupHistory(groupId: string): Promise<GroupHistory> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const group = tables.groups.find((candidate) => candidate.id === groupId);
      if (!group || !canManageGroup(user, group)) {
        throw new DataError('not_found');
      }
      return groupHistoryOf(tables, groupId);
    });
  }
}
