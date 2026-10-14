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

// ---------- marks breakdown ----------
import { assessmentSummary, courseMarks, neededPercent, hasBreakdown } from '../../js/calc.js';

const item = (name, weight, obtained = '', total = '') => ({ id: name, name, weight: String(weight), obtained: String(obtained), total: String(total) });

test('breakdown: running total, pace and what is left', () => {
  const c = { credits: '3', marks: '', grade: '', assessments: [
    item('Quizzes', 10, 8, 10), // 8
    item('Assignments', 10, 18, 20), // 9
    item('Mid 1', 15, 21, 30), // 10.5
    item('Mid 2', 15),
    item('Final', 50),
  ] };
  const s = assessmentSummary(c);
  assert.equal(s.weightTotal, 100);
  assert.equal(s.gradedWeight, 35);
  assert.equal(s.earned, 27.5);
  assert.equal(s.remaining, 65);
  close(s.percentSoFar, (27.5 / 35) * 100);
  assert.equal(s.complete, false);
  assert.equal(courseMarks(c), null, 'an unfinished breakdown does not count yet');
  assert.equal(evaluateCourse(freshData(), c), null);

  // A needs 80: (80 − 27.5) / 65 = 80.77% of the remaining work
  const a = neededPercent(s, 80);
  assert.equal(a.status, 'needed');
  close(a.pct, (52.5 / 65) * 100);
  assert.equal(neededPercent(s, 20).status, 'secured');
  assert.equal(neededPercent({ earned: 10, remaining: 20 }, 80).status, 'impossible');
});

test('breakdown: a complete breakdown sets the course marks', () => {
  const c = { credits: '3', marks: '12', grade: '', assessments: [item('Sessionals', 50, 40, 50), item('Final', 50, 41, 50)] };
  assert.ok(hasBreakdown(c));
  assert.equal(assessmentSummary(c).complete, true);
  assert.equal(courseMarks(c), 81, 'typed marks are ignored when there is a breakdown');
  assert.equal(evaluateCourse(freshData(), c).gp, 4);
});

test('breakdown: problems are reported and stop the course counting', () => {
  const over = { credits: '3', assessments: [item('Mid', 60, 50, 60), item('Final', 50, 40, 50)] };
  assert.match(assessmentSummary(over).problem, /more than 100%/);
  assert.match(evaluateCourse(freshData(), over).error, /more than 100%/);
  const tooHigh = { credits: '3', assessments: [item('Quiz', 100, 12, 10)] };
  assert.match(evaluateCourse(freshData(), tooHigh).error, /between 0 and 10/);
  const short = { credits: '3', assessments: [item('Mid', 40, 30, 40), item('Final', 50, 40, 50)] };
  assert.equal(assessmentSummary(short).complete, false, 'weights must reach 100%');
});

test('breakdown survives normalize; courses without one stay unchanged', () => {
  const n = normalize({ semesters: [{ courses: [{ name: 'A', credits: 3, assessments: [{ name: 'Final', weight: 50, obtained: 40, total: 50 }] }, { name: 'B', credits: 3 }] }] });
  assert.deepEqual(n.semesters[0].courses[0].assessments.map((a) => [a.name, a.weight, a.obtained, a.total]), [['Final', '50', '40', '50']]);
  assert.equal('assessments' in n.semesters[0].courses[1], false);
});

// ---------- sharing ----------
import { newShareCode, cleanShareCode, sharedProgramPayload, programFromShared } from '../../js/calc.js';

test('share codes are 6 easy-to-read characters', () => {
  for (let i = 0; i < 200; i++) assert.match(newShareCode(), /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(newShareCode(() => 0), 'AAAAAA');
});

test('codes are cleaned up from what people type or paste', () => {
  assert.equal(cleanShareCode(' k7p2qx '), 'K7P2QX');
  assert.equal(cleanShareCode('K7P-2QX'), 'K7P2QX');
  assert.equal(cleanShareCode('https://maliq-pak.github.io/CGPA-Calculator/#/join/k7p2qx'), 'K7P2QX');
  assert.equal(cleanShareCode('K7P2Q'), '', 'too short');
  assert.equal(cleanShareCode('K7P2QO'), '', 'O is never used in codes');
  assert.equal(cleanShareCode(''), '');
});

test('shared programs carry course names and credits only', () => {
  const d = freshData();
  d.profile.university = 'FAST';
  d.program.semesters[0].courses[0].marks = '99'; // never part of a program, but make sure nothing leaks
  const p = sharedProgramPayload(d, 'Ali Raza Khan');
  assert.equal(p.name, 'BSCS');
  assert.equal(p.university, 'FAST');
  assert.equal(p.ownerName, 'Ali', 'first name only');
  assert.deepEqual(Object.keys(p.semesters[0].courses[0]).sort(), ['credits', 'name']);
  assert.equal(p.semesters.length, 8);

  const copy = programFromShared(p, 'K7P2QX');
  assert.equal(copy.copiedFrom, 'K7P2QX');
  assert.equal(copy.semesters[6].courses[2].name, 'FYP 1');
  assert.ok(copy.semesters[0].id && copy.semesters[0].courses[0].id);
  assert.deepEqual(programFromShared({}, 'X').semesters, []);
});

// ---------- repeated courses ----------
import { retakeInfo, retakeTarget, sameNameEarlier } from '../../js/calc.js';

function retakeData(policy = 'latest') {
  const d = freshData();
  d.retakePolicy = policy;
  d.semesters = [
    { id: 's1', name: 'Semester 1', courses: [{ id: 'calc1', name: 'Calculus', credits: '3', marks: '45', grade: '' }, { id: 'itc', name: 'ITC', credits: '3', marks: '85', grade: '' }] },
    { id: 's2', name: 'Semester 2', courses: [{ id: 'calc2', name: 'Calculus', credits: '3', marks: '72', grade: '', retakeOf: 'calc1' }, { id: 'oop', name: 'OOP', credits: '4', marks: '65', grade: '' }] },
  ];
  return d;
}

test('a retake replaces the earlier attempt in CGPA but not in its semester GPA', () => {
  const d = retakeData();
  // Without retakes: (0 + 12 + 10.5 + 12) / 13. With the retake, Calculus' F (3 credits) drops out: 34.5 / 10
  close(overallTotals(d).cgpa, 34.5 / 10);
  assert.equal(overallTotals(d).credits, 10);
  close(semesterTotals(d, d.semesters[0]).gpa, 2, 'semester 1 GPA still shows the F');
  const h = history(d);
  close(h[0].cgpa, 2);
  close(h[1].cgpa, 3.45);
});

test('best-attempt policy keeps the better grade', () => {
  const d = retakeData('best');
  d.semesters[1].courses[0].marks = '30'; // retake went worse
  close(overallTotals(d).cgpa, (0 + 12 + 12) / 10, 'both F: either counts once');
  d.semesters[0].courses[0].marks = '62'; // first attempt B
  close(overallTotals(d).cgpa, (9 + 12 + 12) / 10, 'B from the first attempt counts');
  d.retakePolicy = 'latest';
  close(overallTotals(d).cgpa, (0 + 12 + 12) / 10, 'latest policy uses the F');
});

test('retakes of retakes count once; ungraded retakes leave the original counting', () => {
  const d = retakeData();
  d.semesters.push({ id: 's3', name: 'Semester 3', courses: [{ id: 'calc3', name: 'Calculus', credits: '3', marks: '', grade: '', retakeOf: 'calc2' }] });
  close(overallTotals(d).cgpa, 3.45, 'third attempt not graded yet');
  d.semesters[2].courses[0].marks = '90';
  close(overallTotals(d).cgpa, (12 + 12 + 12) / 10);
  const info = retakeInfo(d);
  assert.equal(info.get('calc1').notCounted, true);
  assert.equal(info.get('calc2').notCounted, true);
  assert.equal(info.get('calc2').replacedBy.course.id, 'calc3');
  assert.equal(info.get('calc3').retakeOf.course.id, 'calc2');
  assert.equal(info.get('itc'), undefined);
});

test('invalid retake links are ignored', () => {
  const d = retakeData();
  d.semesters[1].courses[0].retakeOf = 'missing';
  close(overallTotals(d).cgpa, 34.5 / 13);
  d.semesters[1].courses[0].retakeOf = 'calc1';
  [d.semesters[0], d.semesters[1]] = [d.semesters[1], d.semesters[0]]; // retake now comes first
  assert.equal(retakeTarget(d, d.semesters[0].courses[0]), null);
  close(overallTotals(d).cgpa, 34.5 / 13);
});

test('same-name courses in earlier semesters are found for suggestions', () => {
  const d = retakeData();
  delete d.semesters[1].courses[0].retakeOf;
  assert.equal(sameNameEarlier(d, d.semesters[1].courses[0]).course.id, 'calc1');
  assert.equal(sameNameEarlier(d, d.semesters[1].courses[1]), null);
  assert.equal(sameNameEarlier(d, d.semesters[0].courses[0]), null);
  assert.equal(normalize({ semesters: [{ courses: [{ name: 'X', retakeOf: 'a' }] }] }).semesters[0].courses[0].retakeOf, 'a');
  assert.equal(normalize({ retakePolicy: 'best' }).retakePolicy, 'best');
  assert.equal(normalize({ retakePolicy: 'weird' }).retakePolicy, 'latest');
});
