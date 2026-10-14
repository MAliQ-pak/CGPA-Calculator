import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshData, normalize, serialize, evaluateCourse, semesterTotals, overallTotals, history,
  requiredGPA, programCourses, programCredits, scaleProblem, defaultProgram, maxGP, fmt,
} from '../../js/calc.js';

const course = (credits, marks = '', grade = '') => ({ id: Math.random().toString(36), name: 'X', credits: String(credits), marks: String(marks), grade });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('marks map to grade points on the default scale', () => {
  const d = freshData();
  const gp = (m) => evaluateCourse(d, course(3, m)).gp;
  assert.equal(gp(100), 4);
  assert.equal(gp(80), 4);
  assert.equal(gp(79.9), 3.5);
  assert.equal(gp(70), 3.5);
  assert.equal(gp(60), 3);
  assert.equal(gp(55), 2.5);
  assert.equal(gp(50), 2);
  assert.equal(gp(49.5), 0);
  assert.equal(gp(0), 0);
});

test('invalid or incomplete courses are reported and not counted', () => {
  const d = freshData();
  assert.equal(evaluateCourse(d, course(3, 101)).error, 'Marks must be 0–100');
  assert.equal(evaluateCourse(d, course(3, -1)).error, 'Marks must be 0–100');
  assert.equal(evaluateCourse(d, course('', 85)).error, 'Add credit hours');
  assert.equal(evaluateCourse(d, course(0, 85)).error, 'Add credit hours');
  assert.equal(evaluateCourse(d, course(3)), null);
  assert.equal(evaluateCourse(d, course(3, '', 'Z')).error, 'Grade not in scale');
});

test('a grade can be picked instead of marks; marks win when both are set', () => {
  const d = freshData();
  assert.equal(evaluateCourse(d, course(3, '', 'B+')).gp, 3.5);
  assert.equal(evaluateCourse(d, course(3, 85, 'C')).gp, 4);
});

test('semester GPA is credit-weighted and skips unfinished courses', () => {
  const d = freshData();
  // 4×4.0 + 4×3.0 + 3×2.5 + 3×4.0 + 2×3.5(grade) = 54.5 over 16 credits; one course still empty
  const sem = { courses: [course(4, 80), course(4, 65), course(3, 58), course(3, 90), course(2, '', 'B+'), course(2)] };
  const t = semesterTotals(d, sem);
  close(t.points, 54.5);
  assert.equal(t.credits, 16);
  assert.equal(t.pending, 1);
  close(t.gpa, 54.5 / 16);
  assert.equal(semesterTotals(d, { courses: [] }).gpa, null);
});

test('CGPA combines an earlier record with semesters, and history tracks it', () => {
  const d = freshData();
  d.prior = { cgpa: '3.2', credits: '90' };
  d.semesters = [
    { id: 'a', name: 'Semester 7', courses: [course(3, 85), course(3, 72.5), course(3, 65), course(3, 58), course(3, 50)] },
    { id: 'b', name: 'Empty', courses: [course(3)] },
  ];
  const t = overallTotals(d);
  close(t.cgpa, (3.2 * 90 + 45) / 105);
  assert.equal(fmt(t.cgpa), '3.17');
  const h = history(d);
  assert.equal(h.length, 1, 'semesters without grades are left out of history');
  close(h[0].gpa, 3);
  close(h[0].cgpa, t.cgpa);
});

test('an out-of-range earlier CGPA is ignored', () => {
  const d = freshData();
  d.prior = { cgpa: '4.5', credits: '30' };
  assert.equal(overallTotals(d).cgpa, null);
});

test('required GPA for a target', () => {
  const d = freshData();
  d.semesters = [{ id: 'a', name: 'S1', courses: [course(10, 72)] }]; // 3.5 over 10
  let r = requiredGPA(d, 3.7, 10);
  close(r.needed, 3.9);
  assert.ok(r.reachable);
  r = requiredGPA(d, 3.9, 10);
  assert.ok(!r.reachable);
  close(r.best, 3.75);
  assert.ok(requiredGPA(d, 3.0, 10).needed <= 3.0);
});

test('normalize fills gaps and keeps known fields', () => {
  const n = normalize({ semesters: [{ courses: [{ name: 'ITC', credits: 3, marks: 85 }] }], scale: [{ min: 85, grade: 'A', gp: 4 }, { min: 0, grade: 'F', gp: 0 }] });
  assert.equal(n.semesters[0].name, 'Semester 1');
  assert.equal(n.semesters[0].courses[0].credits, '3');
  assert.equal(n.semesters[0].courses[0].marks, '85');
  assert.ok(n.semesters[0].id && n.semesters[0].courses[0].id);
  assert.equal(n.scale[0].min, 85);
  assert.equal(n.profile.setupDone, false);
  assert.equal(n.program.name, 'BSCS');
  assert.deepEqual(normalize(null).semesters, []);
});

test('serialize turns NaN scale cells into null so they can be stored', () => {
  const d = freshData();
  d.scale.push({ min: NaN, grade: '', gp: NaN });
  const s = serialize(d);
  assert.equal(s.scale.at(-1).min, null);
  assert.equal(normalize(s).scale.at(-1).min, NaN);
});

test('scale problems are explained', () => {
  const d = freshData();
  assert.equal(scaleProblem(d), '');
  d.scale.push({ min: 90, grade: 'A', gp: 4 });
  assert.match(scaleProblem(d), /unique/);
  d.scale = [{ min: 50, grade: 'P', gp: 4 }];
  assert.match(scaleProblem(d), /minimum 0/);
  d.scale = [{ min: NaN, grade: 'P', gp: 4 }];
  assert.match(scaleProblem(d), /Every row/);
  assert.equal(maxGP({ scale: [{ min: 0, grade: 'X', gp: 5 }] }), 5);
});

test('default program and program courses', () => {
  const p = defaultProgram();
  assert.equal(p.semesters.length, 8);
  assert.equal(programCredits(p.semesters[0]), 18);
  assert.equal(p.semesters.reduce((s, x) => s + programCredits(x), 0), 129);
  const d = freshData();
  const copies = programCourses(d, 6);
  assert.deepEqual(copies.map((c) => c.name), ['CS Elective 3', 'CS Elective 4', 'FYP 1', 'University Elective III', 'PDC']);
  assert.ok(copies.every((c) => c.marks === '' && c.credits === '3'));
  assert.notEqual(copies[0].id, d.program.semesters[6].courses[0].id, 'copies get their own ids');
  assert.deepEqual(programCourses(d, 99), []);
});
