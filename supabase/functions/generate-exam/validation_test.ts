import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateInput, validateQuestions } from './validation.ts';

const validInput = {
  childId: '11111111-1111-4111-8111-111111111111',
  subjectId: '22222222-2222-4222-8222-222222222222',
  topics: ['Tabuada', 'Raiz quadrada'],
  examDate: '2026-09-14',
  objectiveCount: 2,
  openCount: 1,
  difficulty: 'medium',
};

Deno.test('accepts a valid generation request', () => {
  assertEquals(validateInput(validInput).objectiveCount, 2);
});

Deno.test('rejects invalid quantities', () => {
  assertThrows(() => validateInput({ ...validInput, objectiveCount: 31 }));
  assertThrows(() => validateInput({ ...validInput, objectiveCount: 0, openCount: 0 }));
});

Deno.test('rejects invalid subject and child ids', () => {
  assertThrows(() => validateInput({ ...validInput, subjectId: 'invalid' }));
});

Deno.test('rejects topics outside the allowed list and invalid points', () => {
  assertThrows(() => validateQuestions({ questions: [{ order: 1, type: 'multiple_choice', prompt: 'x', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 'A', referenceAnswer: 'A', explanation: 'x', difficulty: 'medium', topic: 'Outro', points: 1 }] }, 1, 0, ['Tabuada']));
  assertThrows(() => validateQuestions({ questions: [{ order: 1, type: 'open', prompt: 'x', options: [], correctOption: null, referenceAnswer: 'y', explanation: 'x', difficulty: 'medium', topic: 'Tabuada', points: 0 }] }, 0, 1, ['Tabuada']));
});

Deno.test('rejects duplicated prompts and invalid AI response structure', () => {
  assertThrows(() => validateQuestions({ questions: [
    { order: 1, type: 'multiple_choice', prompt: 'Mesma pergunta', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 'A', referenceAnswer: 'A', explanation: 'x', difficulty: 'medium', topic: 'Tabuada', points: 1 },
    { order: 2, type: 'multiple_choice', prompt: 'Mesma pergunta', options: ['A', 'B', 'C', 'D', 'E'], correctOption: 'B', referenceAnswer: 'B', explanation: 'x', difficulty: 'medium', topic: 'Tabuada', points: 1 },
  ] }, 2, 0, ['Tabuada']));

  assertThrows(() => validateQuestions({ questions: [] }, 1, 0, ['Tabuada']));
});

Deno.test('accepts valid objective and open questions', () => {
  const result = validateQuestions({ questions: [
    { order: 1, type: 'multiple_choice', prompt: 'Quanto é 2 + 2?', options: ['1', '2', '3', '4', '5'], correctOption: '4', referenceAnswer: '4', explanation: 'Soma', difficulty: 'medium', topic: 'Tabuada', points: 1 },
    { order: 2, type: 'open', prompt: 'Explique a tabuada.', options: [], correctOption: null, referenceAnswer: 'Resposta', explanation: 'Explicação', difficulty: 'medium', topic: 'Tabuada', points: 1 },
  ] }, 1, 1, ['Tabuada']);
  assertEquals(result.length, 2);
});
