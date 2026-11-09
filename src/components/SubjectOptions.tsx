import React from 'react';
import { SUBJECT_GROUPS, isKnownSubject } from '../data/subjects';

/**
 * Render toàn bộ <option>/<optgroup> môn học từ danh mục dùng chung
 * (src/data/subjects.ts) để thả vào bất kỳ <select> chọn môn nào.
 *
 * Nếu môn hiện tại của đề KHÔNG nằm trong danh mục (đề cũ lưu môn tự do),
 * nó vẫn được render thành một <option> riêng ở đầu danh sách để select
 * không bị trống và giáo viên không bị mất môn đã lưu.
 */
export const SubjectOptions: React.FC<{ current?: string | null }> = ({ current }) => (
  <>
    {current && !isKnownSubject(current) && <option value={current}>{current}</option>}
    {SUBJECT_GROUPS.map((group) =>
      group.subjects.length === 1 && group.subjects[0] === group.label ? (
        <option key={group.label} value={group.subjects[0]}>
          {group.subjects[0]}
        </option>
      ) : (
        <optgroup key={group.label} label={group.label}>
          {group.subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </optgroup>
      )
    )}
  </>
);
