import { TestBed } from '@angular/core/testing';

import { type EnrolledStudent, GroupService } from '../../data/group-service';
import { GroupStudents } from './group-students';

function enrolled(name: string): EnrolledStudent {
  return {
    enrollmentId: `e-${name}`,
    student: { id: name, name, email: `${name}@tutoria.test` },
    active: true,
  };
}

describe('GroupStudents', () => {
  it('tells the count of the group shown, not that of one left while it loaded', async () => {
    const loads = new Map<string, (students: EnrolledStudent[]) => void>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GroupService,
          useValue: {
            listStudents: (groupId: string) =>
              new Promise<EnrolledStudent[]>((resolve) => loads.set(groupId, resolve)),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(GroupStudents);
    const counts: number[] = [];
    fixture.componentInstance.countChange.subscribe((count) => counts.push(count));
    fixture.componentRef.setInput('groupName', 'A');
    fixture.componentRef.setInput('groups', []);
    fixture.componentRef.setInput('groupId', 'a');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(loads.has('a')).toBe(true);
    });
    fixture.componentRef.setInput('groupId', 'b');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(loads.has('b')).toBe(true);
    });

    loads.get('a')?.([enrolled('Ana'), enrolled('Luis'), enrolled('Sara')]);
    loads.get('b')?.([enrolled('Eva')]);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(counts).toEqual([1]);
    });
    expect(fixture.nativeElement.textContent).toContain('Eva');
  });
});
